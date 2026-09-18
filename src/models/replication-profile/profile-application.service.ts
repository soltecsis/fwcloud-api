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

import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { ReplicationProfilePolicy } from '../../policies/replication-profile.policy';
import { AuditLogService } from '../audit/AuditLog.service';
import { Cluster } from '../firewall/Cluster';
import { Firewall } from '../firewall/Firewall';
import { FwCloud } from '../fwcloud/FwCloud';
import { User } from '../user/User';
import { PolicyReplicationService } from './policy-replication.service';
import {
  getProfileProvisioning,
  PolicyReplicationRequest,
  PolicyReplicationResult,
} from './policy-replication.types';
import {
  getProfileParameters,
  resolveParameterValues,
  ReplicationProfileParameterValues,
} from './replication-profile-parameters';
import { ReplicationProfile } from './replication-profile.model';
import { ReplicationProfileService } from './replication-profile.service';
import { normalizeProfileVpnRuleParameters } from './replication-profile-vpn-parameters';
import {
  ProfileVpnCaTemplate,
  ProfileVpnCertificateTemplate,
  provisionVpnTemplatePki,
} from './profile-vpn-pki-provisioning.service';
import { ProfileVpnRollback } from './profile-vpn-rollback';
import {
  ProfileVpnConnectionTemplate,
  provisionVpnTemplateConfigs,
  resolveVpnConnectionValues,
} from './profile-vpn-config-provisioning.service';
import { ResolvedVpnConfig } from './replication-profile.constants';

export const PROFILE_APPLICATION_AUDIT_CALL = 'profiles.apply';

/** Scope/compatibility violations detected before any database write. */
export class ProfileApplicationScopeException extends HttpException {
  constructor(message: string) {
    super(message, 422);
  }
}

export interface ProfileApplicationActor {
  /** Authenticated user requesting the application. */
  user: User;
  sessionId?: number | null;
  sourceIp?: string | null;
}

export interface ProfileApplicationRequest {
  /** FWCloud the wizard is operating on; profile usage is scoped to it. */
  fwCloudId: number;
  profileCode: string;
  profileVersion: number;
  /** Expected catalog scope; when set, the profile scope must match it. */
  expectedScope?: string;
  replication: PolicyReplicationRequest;
  /** Values for the profile's declared parameters, keyed by parameter name. */
  parameters?: ReplicationProfileParameterValues;
  /** Provisioning only: role → name of an existing target interface to bind to it. */
  interfaceNameMapping?: Record<string, string>;
  /**
   * Provisioning only, VPN templates: template connection id -> the real config id the apply
   * wizard already created for it, through the normal VPN panels, before reaching this step. When
   * supplied, this profile's own CA/certificate/VPN-config creation is skipped entirely (it was
   * already done, for real, exactly like an interactive VPN creation would); when absent, they are
   * created here in one batch from the template's declared values, as before.
   */
  vpnConnectionIds?: Record<string, number>;
  /**
   * Transient runtime credentials of the wizard execution flow. They are
   * discarded after the operation: never persisted nor written to audit logs.
   */
  credentials?: Record<string, unknown>;
}

interface TargetInfo {
  kind: 'firewall' | 'cluster';
  id: number;
  name: string;
}

export interface ProfileVpnProvisionResult {
  /** Template connection id -> the real config id just created for it. */
  connectionIds: Record<string, number>;
  errors: string[];
}

/**
 * Secured entry point of the profile application workflow. Wraps
 * the policy replication engine with the explicit authorization, scope
 * validation and audit trail required to expose it to users:
 *
 * - the authenticated user must be allowed to use the FWCloud,
 * - the profile must exist, be active and not deprecated,
 * - the profile must be compatible with the requested target kind,
 * - the target firewall/cluster and the source firewall must belong to the
 *   FWCloud of the request,
 * - every application attempt (including rejected ones) leaves an audit log
 *   entry built from a fixed allow-list of fields, so transient wizard
 *   credentials can never leak into persisted data.
 */
export class ProfileApplicationService extends Service {
  protected _replicationProfileService: ReplicationProfileService;
  protected _policyReplicationService: PolicyReplicationService;
  protected _auditLogService: AuditLogService;

  public async build(): Promise<ProfileApplicationService> {
    this._replicationProfileService = await this._app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    this._policyReplicationService = await this._app.getService<PolicyReplicationService>(
      PolicyReplicationService.name,
    );
    this._auditLogService = await this._app.getService<AuditLogService>(AuditLogService.name);

    return this;
  }

  private get manager() {
    return db.getSource().manager;
  }

  public async apply(
    actor: ProfileApplicationActor,
    request: ProfileApplicationRequest,
  ): Promise<PolicyReplicationResult> {
    const startedAt = new Date();
    let profile: ReplicationProfile | null = null;
    let target: TargetInfo | null = null;
    const vpnRollback = new ProfileVpnRollback();

    try {
      await this.authorizeApplication(actor, request.fwCloudId);

      profile = await this.loadUsableProfile(request);
      target = await this.validateTarget(request);

      const model = normalizeProfileVpnRuleParameters(profile.model);
      const provision = getProfileProvisioning(model);
      let result: PolicyReplicationResult;

      if (provision) {
        // The template's CAs/certificates have no keys of their own; a real firewall generates its
        // own when the profile is applied. A dry run must not create them (or anything else) for real.
        const vpnPkiErrors: string[] = [];
        let vpnConfigIds: Map<string, ResolvedVpnConfig> | undefined;

        if (request.replication.mode !== 'dry_run') {
          const resourced = await this.provisionVpnResources(request, model, target, vpnRollback);
          vpnConfigIds = resourced.vpnConfigIds;
          vpnPkiErrors.push(...resourced.errors);
        }

        // Declarative profile: create interfaces/policy on the target; no source firewall needed.
        result = await this._policyReplicationService.provisionPolicyFromProfile(
          request.replication.target,
          provision,
          request.fwCloudId,
          request.replication.mode,
          {
            parameters: getProfileParameters(model),
            parameterValues: request.parameters,
            profileCode: profile.code,
            profileVersion: profile.version,
            interfaceNameMapping: request.interfaceNameMapping,
            nodeRoleMapping: request.replication.nodeRoleMapping,
            vpnConfigIds,
          },
        );
        result.errors.push(...vpnPkiErrors);
      } else {
        await this.validateSourceFirewall(request);
        result = await this._policyReplicationService.replicatePolicyFromProfile({
          ...request.replication,
          sourceProfile: { ...request.replication.sourceProfile!, profile },
        });
      }

      if (result.errors.length || (request.replication.mode !== 'dry_run' && !result.applied)) {
        await vpnRollback.rollback(result.errors);
        result.applied = false;
      }
      await this.auditAttempt(actor, request, profile, target, startedAt, result);

      return result;
    } catch (error) {
      const failure = await this.rollbackVpnFailure(vpnRollback, error);
      await this.auditAttempt(actor, request, profile, target, startedAt, null, failure);

      throw failure;
    }
  }

  /**
   * Creates a profile's VPN template for real (CAs, certificates and configs) ahead of the final
   * `apply()` call, so the apply wizard can drive the exact same VPN panels a user would use
   * interactively — with a real, already-created certificate to attach the config to — instead of
   * a simulated preview. `apply()` itself calls this too (see provisionVpnResources()); this public
   * entry point exists so the wizard can call it as its own step, before the target's policy exists.
   *
   * Ignores `request.replication.mode`: this always creates real resources (there is no "preview"
   * form of "create a VPN configuration"), unlike apply() itself.
   */
  public async provisionVpn(
    actor: ProfileApplicationActor,
    request: ProfileApplicationRequest,
  ): Promise<ProfileVpnProvisionResult> {
    const startedAt = new Date();
    let profile: ReplicationProfile | null = null;
    let target: TargetInfo | null = null;
    const vpnRollback = new ProfileVpnRollback();

    try {
      await this.authorizeApplication(actor, request.fwCloudId);

      profile = await this.loadUsableProfile(request);
      target = await this.validateTarget(request);

      const model = normalizeProfileVpnRuleParameters(profile.model);
      const { vpnConfigIds, errors } = await this.provisionVpnResources(
        request,
        model,
        target,
        vpnRollback,
      );

      if (errors.length) {
        await vpnRollback.rollback(errors);
      }

      const connectionIds: Record<string, number> = {};
      vpnConfigIds?.forEach((config, connectionId) => {
        connectionIds[connectionId] = config.id;
      });

      await this.auditAttempt(
        actor,
        request,
        profile,
        target,
        startedAt,
        this.emptyPolicyReplicationResult(errors),
      );

      return { connectionIds, errors };
    } catch (error) {
      const failure = await this.rollbackVpnFailure(vpnRollback, error);
      await this.auditAttempt(actor, request, profile, target, startedAt, null, failure);

      throw failure;
    }
  }

  private async authorizeApplication(
    actor: ProfileApplicationActor,
    fwCloudId: number,
  ): Promise<void> {
    const fwCloud = await this.manager.getRepository(FwCloud).findOne({ where: { id: fwCloudId } });
    if (!fwCloud) {
      throw new NotFoundException(`FWCloud ${fwCloudId} not found`);
    }
    (await ReplicationProfilePolicy.apply(actor.user, fwCloud)).authorize();
  }

  private async rollbackVpnFailure(rollback: ProfileVpnRollback, error: unknown): Promise<unknown> {
    const cleanupErrors: string[] = [];
    await rollback.rollback(cleanupErrors);
    return cleanupErrors.length
      ? new HttpException(
          `${this.errorMessageOf(error)} | ${cleanupErrors.join(' | ')}`,
          error instanceof HttpException ? error.status : 500,
        )
      : error;
  }

  /**
   * The actual VPN CA/certificate/config creation, shared by apply() and provisionVpn(). Returns
   * the real config id of every connection it could resolve — either because request.vpnConnectionIds
   * already supplied it (the wizard created it earlier, via provisionVpn()) or because it was just
   * created here from the template's own declared values (the non-wizard / API-only path).
   */
  private async provisionVpnResources(
    request: ProfileApplicationRequest,
    model: unknown,
    target: TargetInfo | null,
    vpnRollback: ProfileVpnRollback,
  ): Promise<{ vpnConfigIds: Map<string, ResolvedVpnConfig> | undefined; errors: string[] }> {
    const errors: string[] = [];
    const vpnTemplate = (
      model as {
        vpnTemplate?: {
          cas?: ProfileVpnCaTemplate[];
          certificates?: ProfileVpnCertificateTemplate[];
          connections?: ProfileVpnConnectionTemplate[];
        };
        vpnRuntime?: unknown;
      }
    ).vpnTemplate;

    if (!vpnTemplate) {
      return { vpnConfigIds: undefined, errors };
    }

    if (request.vpnConnectionIds) {
      // The apply wizard already created these for real, through the normal VPN panels, before
      // reaching this step — nothing left to provision here, just look them up.
      const vpnConfigIds = new Map<string, ResolvedVpnConfig>();

      for (const connection of vpnTemplate.connections ?? []) {
        const realId = request.vpnConnectionIds[connection.id];

        if (realId !== undefined) {
          vpnConfigIds.set(connection.id, { id: realId, protocol: connection.kind });
        }
      }

      return { vpnConfigIds, errors };
    }

    // Validate inputs before generating keys or inserting PKI rows.
    const parameterValues = resolveParameterValues(getProfileParameters(model), request.parameters);
    const dbQuery = db.getQuery();
    const pki = await provisionVpnTemplatePki(
      dbQuery,
      request.fwCloudId,
      vpnTemplate.cas ?? [],
      vpnTemplate.certificates ?? [],
      errors,
      vpnRollback,
    );

    // Real VPN configurations (as opposed to just their CA/certificates) are only created for a
    // single firewall: a cluster's VPN topology (which node(s) actually run each server) is a
    // product decision this profile format does not capture yet.
    if (target?.kind !== 'firewall' || !vpnTemplate.connections?.length) {
      return { vpnConfigIds: undefined, errors };
    }

    const resolvedVpnValues = resolveVpnConnectionValues(
      (model as { vpnRuntime?: unknown }).vpnRuntime,
      parameterValues,
    );

    const vpnConfigIds = await provisionVpnTemplateConfigs(
      dbQuery,
      request.fwCloudId,
      target.id,
      vpnTemplate.connections,
      pki,
      resolvedVpnValues,
      errors,
    );

    return { vpnConfigIds, errors };
  }

  /** A result shape with nothing but the given errors, for auditAttempt()'s summary. */
  private emptyPolicyReplicationResult(errors: string[]): PolicyReplicationResult {
    return {
      mode: 'replace_defaults',
      applied: errors.length === 0,
      createdRules: [],
      createdGroups: [],
      resolvedReferences: [],
      removedDefaultRules: [],
      skippedRules: [],
      conflicts: [],
      warnings: [],
      errors,
    };
  }

  /**
   * Loads the requested profile rejecting unusable ones (missing, disabled,
   * deprecated, wrong scope or incompatible with the target kind) before any
   * change is written.
   */
  protected async loadUsableProfile(
    request: ProfileApplicationRequest,
  ): Promise<ReplicationProfile> {
    const profile = await this._replicationProfileService.findAnyByCodeAndVersion(
      request.profileCode,
      request.profileVersion,
      request.fwCloudId,
    );

    if (!profile) {
      throw new NotFoundException(
        `Replication profile "${request.profileCode}" (version ${request.profileVersion}) not found`,
      );
    }

    if (!profile.isActive) {
      throw new ProfileApplicationScopeException(
        `Replication profile "${profile.name}" is disabled and cannot be applied`,
      );
    }

    if (profile.isDeprecated) {
      throw new ProfileApplicationScopeException(
        `Replication profile "${profile.name}" is deprecated and cannot be applied`,
      );
    }

    if (request.expectedScope !== undefined && profile.scope !== request.expectedScope) {
      throw new ProfileApplicationScopeException(
        `Replication profile "${profile.name}" belongs to scope "${profile.scope}", not to the expected scope "${request.expectedScope}"`,
      );
    }

    if (
      !this._replicationProfileService.supportsTargetKind(profile, request.replication.target.kind)
    ) {
      throw new ProfileApplicationScopeException(
        `Replication profile "${profile.name}" is not compatible with target kind "${request.replication.target.kind}"`,
      );
    }

    return profile;
  }

  /** Verifies that the target firewall/cluster belongs to the request FWCloud. */
  protected async validateTarget(request: ProfileApplicationRequest): Promise<TargetInfo> {
    const { kind, id } = request.replication.target;

    if (kind === 'cluster') {
      const cluster = await this.manager.getRepository(Cluster).findOne({ where: { id } });

      if (!cluster || cluster.fwCloudId !== request.fwCloudId) {
        throw new ProfileApplicationScopeException(
          `Target cluster ${id} does not belong to FWCloud ${request.fwCloudId}`,
        );
      }

      return { kind, id, name: cluster.name };
    }

    const firewall = await this.manager.getRepository(Firewall).findOne({ where: { id } });

    if (!firewall || firewall.fwCloudId !== request.fwCloudId) {
      throw new ProfileApplicationScopeException(
        `Target firewall ${id} does not belong to FWCloud ${request.fwCloudId}`,
      );
    }

    if (firewall.clusterId) {
      throw new ProfileApplicationScopeException(
        `Target firewall ${id} belongs to cluster ${firewall.clusterId}: apply the profile to the cluster instead`,
      );
    }

    return { kind, id, name: firewall.name };
  }

  /** Verifies that the source profile firewall belongs to the request FWCloud. */
  protected async validateSourceFirewall(request: ProfileApplicationRequest): Promise<void> {
    const sourceFirewallId = request.replication.sourceProfile?.firewallId;
    if (!sourceFirewallId) {
      throw new ProfileApplicationScopeException('This profile requires a source firewall.');
    }
    const firewall = await this.manager
      .getRepository(Firewall)
      .findOne({ where: { id: sourceFirewallId } });

    if (!firewall || firewall.fwCloudId !== request.fwCloudId) {
      throw new ProfileApplicationScopeException(
        `Source firewall ${sourceFirewallId} does not belong to FWCloud ${request.fwCloudId}`,
      );
    }
  }

  /**
   * Records the application attempt. The payload is built from a fixed
   * allow-list of fields: transient credentials or any other request data are
   * never copied into the audit entry.
   *
   * Pass the engine result on completed runs (failed when result.errors is
   * not empty) or the thrown error on aborted ones.
   */
  protected async auditAttempt(
    actor: ProfileApplicationActor,
    request: ProfileApplicationRequest,
    profile: ReplicationProfile | null,
    target: TargetInfo | null,
    startedAt: Date,
    result: PolicyReplicationResult | null,
    thrown?: unknown,
  ): Promise<void> {
    const error =
      thrown !== undefined
        ? this.errorMessageOf(thrown)
        : result && result.errors.length > 0
          ? result.errors.join(' | ')
          : null;
    const httpStatus =
      thrown !== undefined
        ? thrown instanceof HttpException
          ? thrown.status
          : 500
        : error === null
          ? 200
          : 422;
    const status = error === null ? 'success' : 'failed';
    const profileLabel = profile
      ? `"${profile.name}" (${profile.code} v${profile.version})`
      : `"${request.profileCode}" (v${request.profileVersion})`;
    const targetLabel = target
      ? `${target.kind} "${target.name}"`
      : `${request.replication.target.kind} ${request.replication.target.id}`;

    await this._auditLogService.logMutation({
      call: PROFILE_APPLICATION_AUDIT_CALL,
      description:
        status === 'success'
          ? `Apply replication profile ${profileLabel} to ${targetLabel} in ${request.replication.mode} mode.`
          : `Apply replication profile ${profileLabel} to ${targetLabel} in ${request.replication.mode} mode failed: ${error}`,
      status: httpStatus,
      startedAt,
      userId: actor.user?.id ?? null,
      userName: actor.user?.username ?? null,
      sessionId: actor.sessionId ?? null,
      sourceIp: actor.sourceIp ?? null,
      fwCloudId: request.fwCloudId,
      firewallId: target?.kind === 'firewall' ? target.id : null,
      clusterId: target?.kind === 'cluster' ? target.id : null,
      data: {
        profileId: profile?.id ?? null,
        profileCode: request.profileCode,
        profileVersion: request.profileVersion,
        profileName: profile?.name ?? null,
        profileScope: profile?.scope ?? null,
        targetKind: request.replication.target.kind,
        targetId: request.replication.target.id,
        targetName: target?.name ?? null,
        fwCloudId: request.fwCloudId,
        mode: request.replication.mode,
        status,
        applied: result?.applied ?? false,
        error,
        durationMs: Date.now() - startedAt.getTime(),
        summary: result
          ? {
              createdRules: result.createdRules.length,
              createdGroups: result.createdGroups.length,
              resolvedReferences: result.resolvedReferences.length,
              removedDefaultRules: result.removedDefaultRules.length,
              skippedRules: result.skippedRules,
              conflicts: result.conflicts.map((conflict) => conflict.message),
              warnings: result.warnings,
              errors: result.errors,
            }
          : null,
      },
    });
  }

  private errorMessageOf(thrown: unknown): string {
    if (thrown instanceof Error) {
      return thrown.message || String(thrown);
    }

    const message = (thrown as { message?: unknown })?.message;
    return typeof message === 'string' && message !== '' ? message : JSON.stringify(thrown);
  }
}
