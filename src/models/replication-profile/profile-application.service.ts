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
  PolicyReplicationProvision,
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
import {
  loadReplicationProfileModel,
  type ReplicationProfileModel,
} from './replication-profile-template';
import { normalizeProfileVpnRuleParameters } from './replication-profile-vpn-parameters';
import {
  ProfileVpnCaTemplate,
  ProfileVpnCertificateTemplate,
  provisionVpnTemplatePki,
} from './profile-vpn-pki-provisioning.service';
import { ProfileVpnRollback } from './profile-vpn-rollback';
import {
  previewVpnTemplateConfigs,
  ProfileVpnConnectionTemplate,
  provisionVpnTemplateConfigs,
  bindVpnOptionParameters,
  loadInterfaceRoleAddresses,
  resolveSuppliedVpnConfigs,
  resolveVpnConnectionValues,
} from './profile-vpn-config-provisioning.service';
import { ResolvedVpnConfig } from './replication-profile.constants';
import type {
  ProfileObjectReplacement,
  ResolvedProfileObjectReference,
} from './replication-profile-object-reference';
import {
  ProfileObjectResolution,
  resolveProfileObjectReferences,
} from './replication-profile-object-reference.service';

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
  /**
   * FWCloud the wizard is operating on. The profile may have been created from
   * another one, but its target and everything it uses must belong to this one.
   */
  fwCloudId: number;
  profileCode: string;
  profileVersion: number;
  /** Expected catalog scope; when set, the profile scope must match it. */
  expectedScope?: string;
  replication: PolicyReplicationRequest;
  /** Values for the profile's declared parameters, keyed by parameter name. */
  parameters?: ReplicationProfileParameterValues;
  /**
   * Replacements of the profile's external objects for this application only, keyed by
   * referenceId: the objects that no longer exist (missingObjects) need one.
   */
  objectReplacements?: Record<string, ProfileObjectReplacement>;
  /** Provisioning only: role → name of an existing target interface to bind to it. */
  interfaceNameMapping?: Record<string, string>;
  /**
   * Provisioning only, VPN templates: template connection id -> the real VPN config the caller has
   * already created for it (for instance through POST .../vpn). Each id is checked to be a config of
   * the target firewall. When supplied, this profile's own CA/certificate/VPN-config creation is
   * skipped; when absent, they are created here from the template's declared values, in the same
   * request as the policy, so a failure rolls all of it back together.
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
  /** As in an application: nothing is created while an external object is missing. */
  missingObjects?: ResolvedProfileObjectReference[];
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

      const usable = await this.loadUsableProfile(request, actor.user.id);
      profile = usable.profile;
      target = await this.validateTarget(request);

      const model = normalizeProfileVpnRuleParameters(usable.model);
      const provision = getProfileProvisioning(model);
      const objects = await this.resolveObjectReferences(model, provision, request);
      let result: PolicyReplicationResult;

      if (objects.errors.length > 0) {
        result = {
          ...this.emptyPolicyReplicationResult(objects.errors, request.replication.mode),
          objectReferences: objects.objectReferences,
          missingObjects: objects.missingObjects,
        };
        await this.auditAttempt(actor, request, profile, target, startedAt, result);

        return result;
      }

      if (provision) {
        // The template's CAs/certificates have no keys of their own; a real firewall generates its
        // own when the profile is applied. A dry run must not create them (or anything else) for
        // real: it only stands in for the VPN clients rules may reference.
        const resourced = await this.provisionVpnResources(request, model, target, vpnRollback);

        if (resourced.errors.length > 0 && request.replication.mode !== 'dry_run') {
          // No VPN, no policy: rules that depend on it must not be written without it.
          result = this.emptyPolicyReplicationResult(resourced.errors, request.replication.mode);
        } else {
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
              vpnConfigIds: resourced.vpnConfigIds,
              externalObjects: objects.bindings,
            },
          );
          result.errors.push(...resourced.errors);
        }
      } else {
        await this.validateSourceFirewall(request);
        result = await this._policyReplicationService.replicatePolicyFromProfile({
          ...request.replication,
          sourceProfile: { ...request.replication.sourceProfile!, profile },
        });
      }

      if (objects.objectReferences.length > 0) {
        result.objectReferences = objects.objectReferences;
        result.missingObjects = [];
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
   * Creates a profile's VPN template for real (CAs, certificates and configs) on its own, ahead of
   * an `apply()` call that then binds the policy to the returned config ids (`vpnConnectionIds`).
   * `apply()` creates the same resources itself when it is not given those ids (see
   * provisionVpnResources()), which is the path the UI uses.
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

      const usable = await this.loadUsableProfile(request, actor.user.id);
      profile = usable.profile;
      target = await this.validateTarget(request);

      const model = normalizeProfileVpnRuleParameters(usable.model);
      // The VPN is created for an application of the profile, which could not use it without them.
      const objects = await this.resolveObjectReferences(
        model,
        getProfileProvisioning(model),
        request,
      );

      if (objects.errors.length > 0) {
        await this.auditAttempt(
          actor,
          request,
          profile,
          target,
          startedAt,
          this.emptyPolicyReplicationResult(objects.errors),
        );

        return {
          connectionIds: {},
          errors: objects.errors,
          missingObjects: objects.missingObjects,
        };
      }

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

  /**
   * Resolves the profile's external objects before anything is written. Each used object that is
   * not available and has no replacement, each replacement that cannot be used and, once all of
   * them are resolved, each object that does not fit where the profile uses it is an error: the
   * application stops there, and the caller can supply what is missing and retry.
   */
  private async resolveObjectReferences(
    model: unknown,
    provision: PolicyReplicationProvision | null,
    request: ProfileApplicationRequest,
  ): Promise<ProfileObjectResolution> {
    const resolution = await resolveProfileObjectReferences(
      model,
      request.fwCloudId,
      request.objectReplacements,
    );

    resolution.errors.push(
      ...resolution.missingObjects.map(
        (reference) =>
          `Object "${reference.sourceName}" (${reference.objectType}) is not available in this FWCloud: send a replacement for "${reference.referenceId}" in objectReplacements.`,
      ),
    );

    if (provision && resolution.errors.length === 0 && resolution.bindings.size > 0) {
      resolution.errors.push(
        ...(await this._policyReplicationService.validateExternalObjects(
          provision,
          resolution.bindings,
        )),
      );
    }

    return resolution;
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
   * already supplied it (validated against the target firewall), or because it was just created
   * here from the template's own declared values (or, in a preview, stands in for what would be).
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

    // As in FWCloud, a cluster's VPN configurations belong to its master node.
    const vpnFirewallId = await this.vpnFirewallIdOf(request.fwCloudId, target);

    if (vpnFirewallId === null && vpnTemplate.connections?.length) {
      errors.push(`Cluster "${target?.name}" has no master node to hold its VPN configurations.`);
      return { vpnConfigIds: undefined, errors };
    }

    if (request.vpnConnectionIds) {
      // Already created by the caller: nothing left to provision, but the ids are the caller's
      // word, so check they really are this firewall's before a rule is linked to them.
      return resolveSuppliedVpnConfigs(
        db.getQuery(),
        request.fwCloudId,
        vpnFirewallId,
        vpnTemplate.connections ?? [],
        request.vpnConnectionIds,
      );
    }

    if (request.replication.mode === 'dry_run') {
      return previewVpnTemplateConfigs(vpnTemplate.connections ?? []);
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

    if (vpnFirewallId === null || !vpnTemplate.connections?.length) {
      return { vpnConfigIds: undefined, errors };
    }

    const resolvedVpnValues = resolveVpnConnectionValues(
      (model as { vpnRuntime?: unknown }).vpnRuntime,
      parameterValues,
    );

    // Only an endpoint bound to an interface role needs the target's interface addresses.
    const interfaceAddresses = vpnTemplate.connections.some((c) =>
      c.options?.some((o) => o.interfaceRole),
    )
      ? await loadInterfaceRoleAddresses(
          dbQuery,
          vpnFirewallId,
          getProfileProvisioning(model)?.interfaces ?? [],
          request.interfaceNameMapping,
        )
      : new Map<string, string>();
    const connections = bindVpnOptionParameters(
      vpnTemplate.connections,
      parameterValues,
      errors,
      interfaceAddresses,
    );

    const vpnConfigIds = await provisionVpnTemplateConfigs(
      dbQuery,
      request.fwCloudId,
      vpnFirewallId,
      connections,
      pki,
      resolvedVpnValues,
      errors,
    );

    return { vpnConfigIds, errors };
  }

  /**
   * The firewall that owns the target's VPN configurations: the firewall itself, or a cluster's
   * master node, which is where FWCloud keeps a cluster's VPNs (and installs them on every node).
   */
  protected async vpnFirewallIdOf(
    fwCloudId: number,
    target: TargetInfo | null,
  ): Promise<number | null> {
    if (!target) {
      return null;
    }

    if (target.kind === 'firewall') {
      return target.id;
    }

    const master = await this.manager
      .getRepository(Firewall)
      .findOne({ where: { clusterId: target.id, fwCloudId, fwmaster: 1 } });

    return master?.id ?? null;
  }

  /** A result shape with nothing but the given errors, for auditAttempt()'s summary. */
  private emptyPolicyReplicationResult(
    errors: string[],
    mode: PolicyReplicationResult['mode'] = 'replace_defaults',
  ): PolicyReplicationResult {
    return {
      mode,
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
   * Loads the requested profile, among the built-in ones and the custom ones
   * of the user applying it, rejecting unusable ones (missing, disabled,
   * deprecated, wrong scope or incompatible with the target kind) before any
   * change is written.
   */
  protected async loadUsableProfile(
    request: ProfileApplicationRequest,
    userId: number,
  ): Promise<{ profile: ReplicationProfile; model: ReplicationProfileModel }> {
    const profile = await this._replicationProfileService.findAnyByCodeAndVersion(
      request.profileCode,
      request.profileVersion,
      userId,
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

    // Loaded once here: the compatibility check and the application share the same model.
    const model = loadReplicationProfileModel(profile);

    if (
      !this._replicationProfileService.supportsTargetKind(
        profile,
        request.replication.target.kind,
        model,
      )
    ) {
      throw new ProfileApplicationScopeException(
        `Replication profile "${profile.name}" is not compatible with target kind "${request.replication.target.kind}"`,
      );
    }

    return { profile, model };
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
