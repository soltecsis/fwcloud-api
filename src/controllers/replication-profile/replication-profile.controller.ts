import { Request } from 'express';
import { Validate } from '../../decorators/validate.decorator';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { ValidationException } from '../../fonaments/exceptions/validation-exception';
import type { ErrorBag } from '../../fonaments/validation/validator';
import { FwCloud } from '../../models/fwcloud/FwCloud';
import { AuditLogHelper } from '../../models/audit/audit-log.helper';
import { ReplicationProfile } from '../../models/replication-profile/replication-profile.model';
import {
  REPLICATION_PROFILE_CATALOG_ORIGINS,
  REPLICATION_PROFILE_TARGET_KINDS,
  normalizeReplicationProfileCatalogOrigin,
  normalizeReplicationProfileTargetKind,
} from '../../models/replication-profile/replication-profile.constants';
import type {
  ReplicationProfileCatalogOrigin,
  ReplicationProfileTargetKind,
} from '../../models/replication-profile/replication-profile.constants';
import {
  DEFAULT_CUSTOM_PROFILE_TARGET_KIND,
  ReplicationProfileService,
  type ReplicationProfileCatalogFilters,
  type CreateCustomReplicationProfileOptions,
  type RemoveCustomReplicationProfileOptions,
  type ReplicationProfileManagementFailureAuditInput,
  type ReplicationProfileMutationActor,
} from '../../models/replication-profile/replication-profile.service';
import type { ReplicationProfileValidationError } from '../../models/replication-profile/replication-profile-validation.service';
import { ProfileApplicationService } from '../../models/replication-profile/profile-application.service';
import type {
  PolicyReplicationMode,
  PolicyReplicationRequest,
} from '../../models/replication-profile/policy-replication.types';
import { ReplicationProfilePolicy } from '../../policies/replication-profile.policy';
import type { Authorization } from '../../fonaments/authorization/policy';
import { ReplicationProfileResponseDto } from './dtos/replication-profile-response.dto';
import { ReplicationProfileApplyDto } from './dtos/replication-profile-apply.dto';
import {
  ReplicationProfileCloneDto,
  ReplicationProfileStoreDto,
  ReplicationProfileVersionStoreDto,
} from './dtos/replication-profile-store.dto';
import { ReplicationProfileFromSourceDto } from './dtos/replication-profile-from-source.dto';
import {
  ReplicationProfileSnapshotService,
  type ReplicationProfileSnapshotSource,
} from '../../models/replication-profile/replication-profile-snapshot.service';

export class ReplicationProfileController extends Controller {
  protected _fwCloud: FwCloud;

  private static readonly catalogQueryKeys = new Set([
    'targetKind',
    'origin',
    'includeDeprecated',
    'search',
  ]);

  public async make(request: Request): Promise<void> {
    this._fwCloud = await FwCloud.findOneOrFail({
      where: { id: parseInt(String(request.params.fwcloud)) },
    });
  }

  @Validate()
  public async index(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.index(request.session.user, this._fwCloud)).authorize();
    const replicationProfileService = await this.replicationProfileService();

    const profiles = await replicationProfileService.findCatalog(
      this.parseCatalogQuery(request.query),
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(profiles.map((profile) => this.toResponse(profile)));
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.show(request.session.user, this._fwCloud)).authorize();
    const replicationProfileService = await this.replicationProfileService();

    const version = this.parseVersionParam(request);

    const profile = await replicationProfileService.findByCodeAndVersion(
      String(request.params.code),
      version,
      this._fwCloud.id,
    );

    if (!profile) {
      throw new NotFoundException('Replication profile not found');
    }

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileStoreDto)
  public async store(request: Request): Promise<ResponseBuilder> {
    const replicationProfileService = await this.replicationProfileService();
    const body = request.body as ReplicationProfileStoreDto;

    await this.assertCanManageProfile(
      request,
      await ReplicationProfilePolicy.create(request.session.user, this._fwCloud),
      replicationProfileService,
      {
        operation: 'create',
        profileCode: this.requestProfileCode(body, replicationProfileService),
        profileVersion: typeof body.version === 'number' ? body.version : 1,
        profileName: body.name,
        targetKind: body.targetKind,
        scope: body.scope,
        category: body.category,
      },
    );

    const profile = await replicationProfileService.createCustomProfile(
      body,
      this.customProfileOptions(request),
    );

    return ResponseBuilder.buildResponse().status(201).body(this.toResponse(profile));
  }

  /**
   * Creates a custom profile by capturing the interfaces and IPv4 FORWARD
   * policy of an existing firewall or cluster of this FWCloud. Responds with
   * the created profile plus the warnings for the rules that could not be
   * expressed in the template vocabulary.
   */
  @Validate(ReplicationProfileFromSourceDto)
  public async storeFromSource(request: Request): Promise<ResponseBuilder> {
    const replicationProfileService = await this.replicationProfileService();
    const body = request.body as ReplicationProfileFromSourceDto;

    await this.assertCanManageProfile(
      request,
      await ReplicationProfilePolicy.create(request.session.user, this._fwCloud),
      replicationProfileService,
      {
        operation: 'create',
        profileCode: this.requestProfileCode(body, replicationProfileService),
        profileVersion: 1,
        profileName: body.name,
        targetKind: body.source?.kind ?? null,
        scope: body.scope ?? null,
        category: body.category ?? null,
      },
    );

    const snapshotService = await this.replicationProfileSnapshotService();
    const { profile, warnings } = await snapshotService.createProfileFromSource(
      {
        source: body.source as ReplicationProfileSnapshotSource,
        name: body.name,
        description: body.description,
        code: body.code,
        scope: body.scope,
        category: body.category,
      },
      this.customProfileOptions(request),
    );

    return ResponseBuilder.buildResponse()
      .status(201)
      .body({
        ...this.toResponse(profile),
        warnings,
      });
  }

  @Validate(ReplicationProfileStoreDto)
  public async validateDefinition(request: Request): Promise<ResponseBuilder> {
    (await ReplicationProfilePolicy.create(request.session.user, this._fwCloud)).authorize();
    const replicationProfileService = await this.replicationProfileService();
    const body = request.body as ReplicationProfileStoreDto;

    const validationErrors = replicationProfileService.validateDefinition({
      targetKind: body.targetKind ?? DEFAULT_CUSTOM_PROFILE_TARGET_KIND,
      model: body.model,
    });

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(this.toValidationResponse(validationErrors));
  }

  @Validate(ReplicationProfileCloneDto)
  public async clone(request: Request): Promise<ResponseBuilder> {
    const code = String(request.params.code);
    const version = this.parseVersionParam(request);
    const body = request.body as ReplicationProfileCloneDto;
    const replicationProfileService = await this.replicationProfileService();

    await this.assertCanManageProfile(
      request,
      await ReplicationProfilePolicy.clone(request.session.user, this._fwCloud),
      replicationProfileService,
      {
        operation: 'clone',
        profileCode: body.code ?? null,
        profileVersion: 1,
        profileName: body.name ?? null,
        sourceProfileCode: code,
        sourceProfileVersion: version,
        targetKind: body.targetKind ?? null,
        scope: body.scope ?? null,
        category: body.category ?? null,
      },
    );

    const profile = await replicationProfileService.cloneCustomProfile(
      code,
      version,
      body,
      this.customProfileOptions(request),
    );

    return ResponseBuilder.buildResponse().status(201).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileVersionStoreDto)
  public async storeVersion(request: Request): Promise<ResponseBuilder> {
    const code = String(request.params.code);
    const replicationProfileService = await this.replicationProfileService();
    const body = request.body as ReplicationProfileVersionStoreDto;

    await this.assertCanManageProfile(
      request,
      await ReplicationProfilePolicy.update(request.session.user, this._fwCloud),
      replicationProfileService,
      {
        operation: 'update',
        profileCode: code,
        profileName: body.name,
        targetKind: body.targetKind,
        scope: body.scope,
        category: body.category,
      },
    );

    const profile = await replicationProfileService.createCustomProfileVersion(
      code,
      body,
      this.customProfileOptions(request),
    );

    return ResponseBuilder.buildResponse().status(201).body(this.toResponse(profile));
  }

  @Validate()
  public async destroy(request: Request): Promise<ResponseBuilder> {
    const code = String(request.params.code);
    const replicationProfileService = await this.replicationProfileService();
    const version = this.parseVersionParam(request);

    await this.assertCanManageProfile(
      request,
      await ReplicationProfilePolicy.delete(request.session.user, this._fwCloud),
      replicationProfileService,
      {
        operation: 'remove',
        profileCode: code,
        profileVersion: version,
      },
    );

    const profile = await replicationProfileService.removeCustomProfile(
      code,
      version,
      this.removeOptions(request),
    );

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(profile));
  }

  @Validate(ReplicationProfileApplyDto)
  public async apply(request: Request): Promise<ResponseBuilder> {
    const version = this.parseVersionParam(request);
    const body = request.body as ReplicationProfileApplyDto;
    const replication = this.toPolicyReplicationRequest(body);

    const profileApplicationService = await this.profileApplicationService();
    const result = await profileApplicationService.apply(
      {
        user: request.session.user,
        sessionId: AuditLogHelper.resolveSessionId(request),
        sourceIp: request.ip ?? null,
      },
      {
        fwCloudId: this._fwCloud.id,
        profileCode: String(request.params.code),
        profileVersion: version,
        expectedScope: body.scope,
        replication,
        credentials: body.credentials,
      },
    );

    return ResponseBuilder.buildResponse()
      .status(result.errors.length > 0 ? 422 : 200)
      .body(result);
  }

  private parseVersionParam(request: Request): number {
    const version = parseInt(String(request.params.version), 10);

    if (Number.isNaN(version)) {
      throw new NotFoundException('Replication profile not found');
    }

    return version;
  }

  private toPolicyReplicationRequest(body: ReplicationProfileApplyDto): PolicyReplicationRequest {
    const replication: PolicyReplicationRequest = {
      target: {
        kind: body.target.kind as ReplicationProfileTargetKind,
        id: body.target.id,
      },
      nodeRoleMapping: body.nodeRoleMapping,
      mode: body.mode as PolicyReplicationMode,
    };

    // Source side is only present for regular (source-based) profiles; provisioning
    // profiles are applied with just the target.
    if (body.sourceProfile) {
      replication.sourceProfile = {
        firewallId: body.sourceProfile.firewallId,
        interfaceRoles: body.sourceProfile.interfaceRoles,
        nodeRoles: body.sourceProfile.nodeRoles,
      };
    }

    if (body.interfaceRoleMapping) {
      replication.interfaceRoleMapping = body.interfaceRoleMapping;
    }

    return replication;
  }

  private parseCatalogQuery(query: Request['query']): ReplicationProfileCatalogFilters {
    const errors: ErrorBag = {};

    for (const key of Object.keys(query)) {
      if (!ReplicationProfileController.catalogQueryKeys.has(key)) {
        errors[key] = ['Unsupported catalog filter.'];
      }
    }

    const targetKind = this.parseTargetKindFilter(query.targetKind, errors);
    const origin = this.parseOriginFilter(query.origin, errors);
    const includeDeprecated = this.parseIncludeDeprecatedFilter(query.includeDeprecated, errors);
    const search = this.parseSearchFilter(query.search, errors);

    if (Object.keys(errors).length > 0) {
      throw new ValidationException('The given data is invalid.', errors, 400);
    }

    return {
      fwCloudId: this._fwCloud.id,
      targetKind,
      origin,
      includeDeprecated,
      search,
    };
  }

  private parseTargetKindFilter(
    value: unknown,
    errors: ErrorBag,
  ): ReplicationProfileTargetKind | undefined {
    if (value === undefined) {
      return undefined;
    }

    return this.parseAllowedQueryValue(
      value,
      errors,
      'targetKind',
      REPLICATION_PROFILE_TARGET_KINDS,
      normalizeReplicationProfileTargetKind,
    );
  }

  private parseOriginFilter(value: unknown, errors: ErrorBag): ReplicationProfileCatalogOrigin {
    if (value === undefined) {
      return 'all';
    }

    return (
      this.parseAllowedQueryValue(
        value,
        errors,
        'origin',
        REPLICATION_PROFILE_CATALOG_ORIGINS,
        normalizeReplicationProfileCatalogOrigin,
      ) ?? 'all'
    );
  }

  private parseIncludeDeprecatedFilter(value: unknown, errors: ErrorBag): boolean {
    if (value === undefined) {
      return false;
    }

    const parsed = this.parseSingleQueryValue(value);
    const normalized = typeof parsed === 'string' ? parsed.trim().toLowerCase() : parsed;

    if (normalized === 'true' || normalized === true) {
      return true;
    }

    if (normalized === 'false' || normalized === false) {
      return false;
    }

    errors.includeDeprecated = ['includeDeprecated must be either true or false.'];
    return false;
  }

  private parseSearchFilter(value: unknown, errors: ErrorBag): string | undefined {
    if (value === undefined) {
      return undefined;
    }

    const parsed = this.parseSingleQueryValue(value);
    if (typeof parsed !== 'string') {
      errors.search = ['search must be a string.'];
      return undefined;
    }

    const trimmed = parsed.trim();

    return trimmed.length > 0 ? trimmed : undefined;
  }

  private parseAllowedQueryValue<T extends string>(
    value: unknown,
    errors: ErrorBag,
    field: string,
    allowed: readonly T[],
    normalize: (value: unknown) => T | null,
  ): T | undefined {
    const parsed = normalize(this.parseSingleQueryValue(value));

    if (!parsed) {
      errors[field] = [`${field} must be one of: ${allowed.join(', ')}.`];
    }

    return parsed ?? undefined;
  }

  private parseSingleQueryValue(value: unknown): string | boolean | null {
    if (typeof value === 'string' || typeof value === 'boolean') {
      return value;
    }

    return null;
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
  }

  // Services are resolved lazily so read endpoints never build the heavier
  // apply-service dependency chain. The DI container already returns cached
  // singletons, so no per-request memoization is needed here.
  private replicationProfileService(): Promise<ReplicationProfileService> {
    return this._app.getService<ReplicationProfileService>(ReplicationProfileService.name);
  }

  private profileApplicationService(): Promise<ProfileApplicationService> {
    return this._app.getService<ProfileApplicationService>(ProfileApplicationService.name);
  }

  private replicationProfileSnapshotService(): Promise<ReplicationProfileSnapshotService> {
    return this._app.getService<ReplicationProfileSnapshotService>(
      ReplicationProfileSnapshotService.name,
    );
  }

  private async assertCanManageProfile(
    request: Request,
    authorization: Authorization,
    replicationProfileService: ReplicationProfileService,
    failure: Omit<
      ReplicationProfileManagementFailureAuditInput,
      'actor' | 'fwCloudId' | 'reason' | 'startedAt' | 'status'
    >,
  ): Promise<void> {
    if (authorization.can()) {
      return;
    }

    await replicationProfileService.auditProfileManagementFailure({
      ...failure,
      fwCloudId: this._fwCloud.id,
      actor: this.mutationActor(request),
      reason: 'Forbidden',
      status: 403,
      startedAt: new Date(),
    });

    throw new HttpException('Forbidden', 403);
  }

  private resolveUserId(request: Request): number | null {
    return request.session.user?.id ?? request.session.user_id ?? null;
  }

  private mutationActor(request: Request): ReplicationProfileMutationActor {
    return {
      userId: this.resolveUserId(request),
      userName: request.session.user?.username ?? null,
      sessionId: AuditLogHelper.resolveSessionId(request),
      sourceIp: request.ip ?? null,
    };
  }

  private customProfileOptions(request: Request): CreateCustomReplicationProfileOptions {
    const options = this.profileMutationOptions(request);

    return {
      ...options,
      userId: options.actor?.userId ?? null,
    };
  }

  private removeOptions(request: Request): RemoveCustomReplicationProfileOptions {
    return this.profileMutationOptions(request);
  }

  private profileMutationOptions(request: Request): RemoveCustomReplicationProfileOptions {
    return {
      fwCloudId: this._fwCloud.id,
      actor: this.mutationActor(request),
    };
  }

  private requestProfileCode(
    body: Partial<ReplicationProfileStoreDto>,
    replicationProfileService: ReplicationProfileService,
  ): string | null {
    if (typeof body.code === 'string' && body.code.trim().length > 0) {
      return body.code;
    }

    return typeof body.name === 'string' && body.name.trim().length > 0
      ? replicationProfileService.slugFromName(body.name)
      : null;
  }

  private toResponse(profile: ReplicationProfile): ReplicationProfileResponseDto {
    const isCustom = !profile.isBuiltin;

    return {
      id: profile.id,
      code: profile.code,
      version: profile.version,
      name: profile.name,
      description: profile.description,
      scope: profile.scope,
      category: profile.category,
      targetKind: profile.targetKind,
      model: profile.model,
      isBuiltin: profile.isBuiltin,
      isCustom,
      isActive: profile.isActive,
      isDeprecated: profile.isDeprecated,
      fwcloudId: profile.fwCloudId,
      createdBy: profile.created_by,
      updatedBy: profile.updated_by,
      createdAt: this.toIsoString(profile.created_at),
      updatedAt: this.toIsoString(profile.updated_at),
      is_built_in: profile.isBuiltin,
      is_active: profile.isActive,
      is_deprecated: profile.isDeprecated,
      fwcloud_id: profile.fwCloudId,
    };
  }

  private toValidationResponse(
    validationErrors: ReplicationProfileValidationError[],
  ): Record<string, unknown> {
    const warnings = validationErrors.filter((error) => error.severity === 'warning');
    const errors = validationErrors.filter((error) => error.severity !== 'warning');

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }
}
