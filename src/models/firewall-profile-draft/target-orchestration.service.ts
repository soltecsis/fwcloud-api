/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { DataSource, In } from 'typeorm';
import { app } from '../../fonaments/abstract-application';
import { Service } from '../../fonaments/services/service';
import { DatabaseService } from '../../database/database.service';
import { dbQuery, legacyConnection } from '../replication-profile/replication-sql.helpers';
import {
  Firewall,
  FireWallOptMask,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../firewall/Firewall';
import { Cluster } from '../firewall/Cluster';
import { Interface } from '../interface/Interface';
import { PolicyRule } from '../policy/PolicyRule';
import { Tree } from '../tree/Tree';
import { User } from '../user/User';
import {
  normalizeReplicationProfileTargetKind,
  type ReplicationProfileTargetKind,
} from '../replication-profile/replication-profile.constants';
import { getProfileProvisioning } from '../replication-profile/policy-replication.types';
import {
  ReplicationProfileService,
  type CreateCustomReplicationProfilePayload,
} from '../replication-profile/replication-profile.service';
import { ProfileApplicationService } from '../replication-profile/profile-application.service';
import {
  describeApplyError,
  materializeCustomProfileFromDraftProposal,
} from './firewall-profile-draft-profile-materialization';
import { FirewallProfileDraft } from './firewall-profile-draft.model';
import { FirewallProfileDraftStateService } from './firewall-profile-draft-state.service';
import type {
  FirewallProfileDraftStepLogEntry,
  FirewallProfileDraftStepResourceIds,
  FirewallProfileDraftTargetIds,
  FirewallProfileDraftTargetKind,
} from './firewall-profile-draft.types';
import {
  TARGET_ORCHESTRATION_STEPS,
  type TargetOrchestrationContext,
  type TargetOrchestrationResult,
  type TargetOrchestrationStepName,
} from './target-orchestration.types';
import { TARGET_ORCHESTRATION_ERROR_CODES } from './target-orchestration.errors';
import {
  TargetOrchestrationAlreadyStartedError,
  TargetOrchestrationInvalidStateError,
  TargetOrchestrationProposalError,
} from './target-orchestration.errors';

const utilsModel = require('../../utils/utils.js');

interface OrchestrationPlan {
  targetKind: FirewallProfileDraftTargetKind;
  targetName: string;
  nodeNames: string[];
  expectedInterfaceNames: string[];
  profilePayload: CreateCustomReplicationProfilePayload;
}

/**
 * Orchestrates the real mutations a confirmed Assisted Profile apply needs
 * when the generated proposal targets infrastructure that does not exist
 * yet: create the firewall/cluster, then delegate interface creation and
 * policy application to the existing `ProfileApplicationService` flow.
 *
 * Must only be invoked once a draft has already, atomically, entered
 * `apply_pending` (the confirmed-apply guard chain is out of this service's
 * scope: it is the caller's job, see the "Integration Boundary" of the
 * originating issue). `execute()` always reloads the draft itself and
 * refuses to run twice against the same draft (see
 * `TargetOrchestrationAlreadyStartedError`) -- there is no automatic resume,
 * retry or rollback anywhere in this class by design.
 *
 * ## Why `interfaces_created` and `profile_applied` share one mutation
 *
 * The only existing, reusable implementation that creates the interfaces a
 * provisioning profile declares is `PolicyReplicationService.provisionPolicyFromProfile()`,
 * invoked through `ProfileApplicationService.apply()`. It creates the target's
 * interfaces *and* its policy rules within the same call, with no way to ask
 * it to skip interface creation for interfaces that already exist. Building a
 * second, separate interface-creation path only to get an artificially
 * earlier durability checkpoint would duplicate that logic and risk creating
 * orphaned duplicate interfaces the profile apply does not know about --
 * exactly what "reuse existing creation logic" rules out.
 *
 * Instead, `execute()` calls `apply()` once and, from its outcome, persists
 * two step-log entries in sequence: `interfaces_created` (interface ids taken
 * from the successful result, or reconstructed by querying the target's
 * interfaces by expected name when `apply()` throws) followed by
 * `profile_applied`. The residual crash window this leaves (the process dying
 * between `apply()` returning and either step being persisted) is the same
 * category of documented limitation the design calls out for the
 * resource-mutation / step-log boundary in general.
 */
export class TargetOrchestrationService extends Service {
  private dataSource: DataSource;
  private stateService: FirewallProfileDraftStateService;
  private replicationProfileService: ReplicationProfileService;
  private profileApplicationService: ProfileApplicationService;

  public async build(): Promise<TargetOrchestrationService> {
    const database = await this._app.getService<DatabaseService>(DatabaseService.name);
    this.dataSource = database.dataSource;
    this.stateService = await this._app.getService<FirewallProfileDraftStateService>(
      FirewallProfileDraftStateService.name,
    );
    this.replicationProfileService = await this._app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    this.profileApplicationService = await this._app.getService<ProfileApplicationService>(
      ProfileApplicationService.name,
    );
    return this;
  }

  public async execute(
    draft: FirewallProfileDraft,
    context: TargetOrchestrationContext,
  ): Promise<TargetOrchestrationResult> {
    let current = await this.stateService.loadForProcessing(draft.id, context.fwCloudId);

    if (current.status !== 'apply_pending') {
      throw new TargetOrchestrationInvalidStateError(current.id, current.status);
    }

    const alreadyStarted = (current.stepLog ?? []).some((entry) =>
      (TARGET_ORCHESTRATION_STEPS as readonly string[]).includes(entry.step),
    );
    if (alreadyStarted) {
      throw new TargetOrchestrationAlreadyStartedError(current.id);
    }

    const plan = this.buildPlan(current);
    const targetIds: FirewallProfileDraftTargetIds = { ...(current.targetIds ?? {}) };

    // --- Step 1: create the target (firewall or cluster) -----------------
    let targetResourceIds: FirewallProfileDraftStepResourceIds;
    try {
      if (plan.targetKind === 'firewall') {
        const { firewallId } = await this.createStandaloneFirewall(
          context.fwCloudId,
          plan.targetName,
          context.userId,
        );
        targetIds.firewallId = firewallId;
        targetResourceIds = { firewallId };
      } else {
        const { clusterId, nodeIds, masterFirewallId } = await this.createCluster(
          context.fwCloudId,
          plan.targetName,
          plan.nodeNames,
          context.userId,
        );
        targetIds.clusterId = clusterId;
        targetIds.nodeIds = nodeIds;
        targetIds.masterFirewallId = masterFirewallId;
        targetResourceIds = { clusterId, nodeIds, masterFirewallId };
      }
    } catch (error) {
      return this.failStep(
        current,
        context,
        'target_created',
        plan.targetKind,
        targetIds,
        undefined,
        TARGET_ORCHESTRATION_ERROR_CODES.TARGET_CREATION_FAILED,
        describeApplyError(error),
      );
    }

    current = await this.stateService.recordOrchestrationStep(
      current.id,
      this.successEntry(context, 'target_created', plan.targetKind, targetResourceIds),
      { fwCloudId: context.fwCloudId, userId: context.userId, targetIds },
    );

    // --- Steps 2+3: materialize the profile, then apply it ---------------
    const applyTargetId =
      plan.targetKind === 'cluster' ? targetIds.clusterId! : targetIds.firewallId!;
    const interfaceOwnerFirewallId =
      plan.targetKind === 'cluster' ? targetIds.masterFirewallId! : targetIds.firewallId!;

    let profileCode: string;
    let profileVersion: number;
    try {
      const profile = await materializeCustomProfileFromDraftProposal(
        this.replicationProfileService,
        plan.profilePayload,
        { fwCloudId: context.fwCloudId, userId: context.userId },
      );
      profileCode = profile.code;
      profileVersion = profile.version;
      targetIds.profileId = profile.id;
      targetIds.profileVersion = profile.version;
    } catch (error) {
      return this.failStep(
        current,
        context,
        'profile_applied',
        plan.targetKind,
        targetIds,
        undefined,
        TARGET_ORCHESTRATION_ERROR_CODES.PROFILE_APPLY_FAILED,
        describeApplyError(error),
      );
    }

    // Not part of the try/catch above by design: this failure is never
    // reinterpreted as a "profile apply failed" outcome (see the class doc).
    const user = await this.dataSource.getRepository(User).findOneByOrFail({ id: context.userId! });

    let applyResult: Awaited<ReturnType<ProfileApplicationService['apply']>>;
    try {
      applyResult = await this.profileApplicationService.apply(
        { user, sessionId: null, sourceIp: null },
        {
          fwCloudId: context.fwCloudId,
          profileCode,
          profileVersion,
          replication: {
            target: { kind: plan.targetKind, id: applyTargetId },
            mode: 'replace_defaults',
          },
        },
      );
    } catch (error) {
      const foundInterfaceIds = await this.findCreatedInterfaceIds(
        interfaceOwnerFirewallId,
        plan.expectedInterfaceNames,
      );

      if (foundInterfaceIds.length < plan.expectedInterfaceNames.length) {
        targetIds.interfaceIds = foundInterfaceIds;
        return this.failStep(
          current,
          context,
          'interfaces_created',
          plan.targetKind,
          targetIds,
          { interfaceIds: foundInterfaceIds },
          TARGET_ORCHESTRATION_ERROR_CODES.INTERFACE_CREATION_FAILED,
          describeApplyError(error),
        );
      }

      current = await this.recordInterfacesCreated(
        current,
        context,
        plan.targetKind,
        targetIds,
        foundInterfaceIds,
      );
      return this.failStep(
        current,
        context,
        'profile_applied',
        plan.targetKind,
        targetIds,
        undefined,
        TARGET_ORCHESTRATION_ERROR_CODES.PROFILE_APPLY_FAILED,
        describeApplyError(error),
      );
    }

    // Deliberately outside the try/catch above: a failure recording one of
    // these two already-successful steps is an orchestration-internal
    // problem (e.g. a lost CAS race), not a domain apply failure, and must
    // never be reinterpreted as "interface creation failed" or "profile
    // apply failed" by the catch block meant for `apply()` itself.
    const interfaceIds = applyResult.resolvedReferences
      .filter((reference) => reference.kind === 'interface')
      .map((reference) => reference.targetId);
    current = await this.recordInterfacesCreated(
      current,
      context,
      plan.targetKind,
      targetIds,
      interfaceIds,
    );
    current = await this.stateService.recordOrchestrationStep(
      current.id,
      this.successEntry(context, 'profile_applied', plan.targetKind, {}),
      { fwCloudId: context.fwCloudId, userId: context.userId, targetIds },
    );

    const applied = await this.stateService.transition(current.id, 'apply_pending', 'applied', {
      fwCloudId: context.fwCloudId,
      userId: context.userId,
      requestId: context.requestId,
      step: 'applied',
      targetIds,
    });

    return { draft: applied, targetKind: plan.targetKind, succeeded: true };
  }

  // --- Proposal parsing ----------------------------------------------------

  private buildPlan(draft: FirewallProfileDraft): OrchestrationPlan {
    const proposal = draft.proposal as
      (CreateCustomReplicationProfilePayload & { targetKind?: string }) | null | undefined;

    if (!proposal || typeof proposal !== 'object') {
      throw new TargetOrchestrationProposalError(draft.id, 'the draft has no stored proposal');
    }

    const targetKind = normalizeReplicationProfileTargetKind(proposal.targetKind);
    if (!targetKind) {
      throw new TargetOrchestrationProposalError(
        draft.id,
        `unsupported or missing target kind '${String(proposal.targetKind)}'`,
      );
    }

    const provision = getProfileProvisioning(proposal.model);
    if (!provision) {
      throw new TargetOrchestrationProposalError(
        draft.id,
        'the stored proposal has no declarative provisioning block; target orchestration only ' +
          'supports provisioning-mode profiles (no existing source firewall)',
      );
    }

    const nodeNames = this.readTopologyNodeNames(proposal, targetKind);

    return {
      targetKind,
      targetName: proposal.name,
      nodeNames,
      expectedInterfaceNames: provision.interfaces.map((iface) => iface.name),
      profilePayload: {
        name: proposal.name,
        description: proposal.description,
        code: proposal.code,
        version: proposal.version,
        scope: proposal.scope,
        targetKind: proposal.targetKind,
        category: proposal.category,
        model: proposal.model,
      },
    };
  }

  private readTopologyNodeNames(
    proposal: CreateCustomReplicationProfilePayload,
    targetKind: ReplicationProfileTargetKind,
  ): string[] {
    if (targetKind !== 'cluster') {
      return [];
    }

    const model = proposal.model as { topologyPreset?: unknown } | null | undefined;
    const topologyPreset = model?.topologyPreset as { nodes?: unknown } | null | undefined;
    const nodes: unknown[] = Array.isArray(topologyPreset?.nodes) ? topologyPreset!.nodes : [];

    return nodes
      .map((node) => {
        const name = (node as { name?: unknown } | null)?.name;
        return typeof name === 'string' ? name : null;
      })
      .filter((name): name is string => name !== null);
  }

  // --- Target creation (firewall / cluster) ---------------------------------

  /**
   * No application-layer "create a firewall" service exists in fwcloud-api:
   * the only reusable creation logic is the sequence of static `Model`
   * methods the legacy `POST /firewall` route calls directly (see
   * `src/routes/firewall/firewall.js`). This mirrors that exact sequence
   * instead of re-implementing firewall creation, per the "no self-HTTP,
   * call the underlying logic directly" rule.
   */
  private async createStandaloneFirewall(
    fwCloudId: number,
    name: string,
    userId: number | null,
  ): Promise<{ firewallId: number }> {
    const maxFirewalls = app().config.get('limits').firewalls;
    if (
      maxFirewalls > 0 &&
      (await Firewall.getCountFirewallsInFWCloud(fwCloudId)) >= maxFirewalls
    ) {
      throw new Error(`FWCloud ${fwCloudId} has reached its firewall limit (${maxFirewalls})`);
    }

    const dbCon = await legacyConnection();
    let firewallData = this.baseFirewallData(fwCloudId, name, null, 0, userId);
    firewallData = (await Firewall.checkBodyFirewall(firewallData, true)) as Record<
      string,
      unknown
    >;

    const firewallId = (await Firewall.insertFirewall(firewallData)) as number;
    await Firewall.updateFWMaster(userId, fwCloudId, null, firewallId, 0);
    await this.provisionMasterFirewallEssentials(dbCon, fwCloudId, firewallId);

    const rootNodeId = await this.findFirewallsRootNodeId(fwCloudId);
    await Tree.insertFwc_Tree_New_firewall(fwCloudId, rootNodeId, firewallId);
    await utilsModel.createFirewallDataDir(fwCloudId, firewallId);

    return { firewallId };
  }

  /** Mirrors `src/routes/firewall/cluster.js`'s `POST /` handler; see `createStandaloneFirewall`. */
  private async createCluster(
    fwCloudId: number,
    name: string,
    nodeNames: string[],
    userId: number | null,
  ): Promise<{ clusterId: number; nodeIds: number[]; masterFirewallId: number }> {
    const limits = app().config.get('limits');
    if (limits.clusters > 0 && (await this.countClusters(fwCloudId)) >= limits.clusters) {
      throw new Error(`FWCloud ${fwCloudId} has reached its cluster limit (${limits.clusters})`);
    }
    if (limits.nodes > 0 && nodeNames.length > limits.nodes) {
      throw new Error(
        `Requested ${nodeNames.length} cluster nodes exceeds the limit (${limits.nodes})`,
      );
    }

    const dbCon = await legacyConnection();
    const clusterId = (await Cluster.insertCluster({
      name,
      comment: 'Created by Assisted Profile.',
      fwcloud: fwCloudId,
      plugins: 0,
    })) as number;

    const nodeIds: number[] = [];
    let masterFirewallId: number | null = null;

    for (let i = 0; i < nodeNames.length; i++) {
      const isMaster = i === 0;
      let firewallData = this.baseFirewallData(
        fwCloudId,
        nodeNames[i],
        clusterId,
        isMaster ? 1 : 0,
        userId,
      );
      firewallData = (await Firewall.checkBodyFirewall(firewallData, true)) as Record<
        string,
        unknown
      >;

      const firewallId = (await Firewall.insertFirewall(firewallData)) as number;
      await Firewall.updateFWMaster(userId, fwCloudId, clusterId, firewallId, isMaster ? 1 : 0);
      nodeIds.push(firewallId);

      if (isMaster) {
        masterFirewallId = firewallId;
        await this.provisionMasterFirewallEssentials(dbCon, fwCloudId, firewallId);
      }
    }

    if (masterFirewallId === null) {
      throw new Error(`Cluster ${clusterId} was requested with no nodes`);
    }

    const rootNodeId = await this.findFirewallsRootNodeId(fwCloudId);
    await Tree.insertFwc_Tree_New_cluster(fwCloudId, rootNodeId, clusterId);

    return { clusterId, nodeIds, masterFirewallId };
  }

  /**
   * The loopback interface, default policy, special rules and data directory
   * every master/standalone firewall needs, shared by `createStandaloneFirewall`
   * and the master-node branch of `createCluster`.
   */
  private async provisionMasterFirewallEssentials(
    dbCon: unknown,
    fwCloudId: number,
    firewallId: number,
  ): Promise<void> {
    const loData = await Interface.createLoInterface(dbCon, fwCloudId, firewallId);
    await PolicyRule.insertDefaultPolicy(firewallId, loData.ifId, FireWallOptMask.STATEFUL);
    await PolicyRule.checkSpecialRules(dbCon, firewallId, FireWallOptMask.STATEFUL);
    await utilsModel.createFirewallDataDir(fwCloudId, firewallId);
  }

  private baseFirewallData(
    fwCloudId: number,
    name: string,
    clusterId: number | null,
    fwmaster: 0 | 1,
    userId: number | null,
  ): Record<string, unknown> {
    return {
      id: null,
      cluster: clusterId,
      name,
      status: 3,
      comment: 'Created by Assisted Profile.',
      fwcloud: fwCloudId,
      install_communication: FirewallInstallCommunication.Agent,
      install_user: '',
      install_pass: '',
      save_user_pass: false,
      install_interface: null,
      install_ipobj: null,
      install_apikey: null,
      install_protocol: FirewallInstallProtocol.HTTPS,
      fwmaster,
      install_port: 22,
      by_user: userId,
      options: FireWallOptMask.STATEFUL,
      plugins: 0,
    };
  }

  private async countClusters(fwCloudId: number): Promise<number> {
    const rows = await dbQuery<{ count: number }>(
      'SELECT COUNT(*) as count FROM cluster WHERE fwcloud = ?',
      [fwCloudId],
    );
    return rows[0]?.count ?? 0;
  }

  private async findFirewallsRootNodeId(fwCloudId: number): Promise<number> {
    const rows = await dbQuery<{ id: number }>(
      "SELECT id FROM fwc_tree WHERE node_type = 'FDF' AND fwcloud = ? AND id_parent IS NULL LIMIT 1",
      [fwCloudId],
    );
    if (rows.length === 0) {
      throw new Error(`FWCloud ${fwCloudId} has no root firewalls tree node`);
    }
    return rows[0].id;
  }

  private async findCreatedInterfaceIds(
    firewallId: number,
    expectedNames: string[],
  ): Promise<number[]> {
    if (expectedNames.length === 0) {
      return [];
    }
    const rows = await this.dataSource
      .getRepository(Interface)
      .find({ where: { firewallId, name: In(expectedNames) }, select: { id: true } });
    return rows.map((row) => row.id);
  }

  // --- Step log / result helpers -------------------------------------------

  private successEntry(
    context: TargetOrchestrationContext,
    step: TargetOrchestrationStepName,
    targetKind: FirewallProfileDraftTargetKind,
    resourceIds: FirewallProfileDraftStepResourceIds,
  ): FirewallProfileDraftStepLogEntry {
    return {
      step,
      status: 'success',
      timestamp: new Date().toISOString(),
      targetKind,
      ...(Object.keys(resourceIds).length > 0 ? { resourceIds } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    };
  }

  /** Shared by both the direct-success path and the "recovered after a failed apply" path. */
  private recordInterfacesCreated(
    draft: FirewallProfileDraft,
    context: TargetOrchestrationContext,
    targetKind: FirewallProfileDraftTargetKind,
    targetIds: FirewallProfileDraftTargetIds,
    interfaceIds: number[],
  ): Promise<FirewallProfileDraft> {
    targetIds.interfaceIds = interfaceIds;
    return this.stateService.recordOrchestrationStep(
      draft.id,
      this.successEntry(context, 'interfaces_created', targetKind, { interfaceIds }),
      { fwCloudId: context.fwCloudId, userId: context.userId, targetIds },
    );
  }

  /** Transitions the draft to `apply_failed` and returns the failed `TargetOrchestrationResult` directly. */
  private async failStep(
    draft: FirewallProfileDraft,
    context: TargetOrchestrationContext,
    step: TargetOrchestrationStepName,
    targetKind: FirewallProfileDraftTargetKind,
    targetIds: FirewallProfileDraftTargetIds,
    resourceIds: FirewallProfileDraftStepResourceIds | undefined,
    errorCode: string,
    message: string,
  ): Promise<TargetOrchestrationResult> {
    const failedDraft = await this.stateService.transition(
      draft.id,
      'apply_pending',
      'apply_failed',
      {
        fwCloudId: context.fwCloudId,
        userId: context.userId,
        requestId: context.requestId,
        step,
        message,
        errorCode,
        targetKind,
        resourceIds,
        targetIds,
      },
    );
    return { draft: failedDraft, targetKind, succeeded: false, failedStep: step, errorCode };
  }
}
