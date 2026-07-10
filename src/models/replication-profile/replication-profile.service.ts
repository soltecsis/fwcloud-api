import db from '../../database/database-manager';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Service } from '../../fonaments/services/service';
import { FindOptionsOrder, FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { ReplicationProfile } from './replication-profile.model';
import {
  type ReplicationProfileCatalogOrigin,
  getReplicationProfileModelTargetKinds,
  isReplicationProfileStringValue,
  normalizeReplicationProfileTargetKinds,
  REPLICATION_PROFILE_TARGET_KINDS,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';
import {
  ReplicationProfileValidationError,
  ReplicationProfileValidationService,
} from './replication-profile-validation.service';
import { AuditLogService } from '../audit/AuditLog.service';

export const PROFILE_CREATE_AUDIT_CALL = 'assistant.profiles.create';
export const PROFILE_CLONE_AUDIT_CALL = 'assistant.profiles.clone';
export const PROFILE_VERSION_AUDIT_CALL = 'assistant.profiles.version';
export const PROFILE_REMOVE_AUDIT_CALL = 'assistant.profiles.remove';
export const DEFAULT_CUSTOM_PROFILE_TARGET_KIND: ReplicationProfileTargetKind = 'firewall';

export type ReplicationProfileManagementOperation = 'create' | 'clone' | 'update' | 'remove';

export interface CreateCustomReplicationProfilePayload {
  name: string;
  description?: string | null;
  code?: string;
  version?: number;
  scope: string;
  targetKind?: string;
  category?: string | null;
  model: unknown;
}

export interface CreateCustomReplicationProfileOptions {
  fwCloudId: number;
  userId?: number | null;
  actor?: ReplicationProfileMutationActor;
}

export interface CloneCustomReplicationProfilePayload {
  code?: string;
  name?: string;
  description?: string | null;
  scope?: string;
  targetKind?: string;
  category?: string | null;
}

/** Identity of the user requesting a mutation, used to enrich the audit trail. */
export interface ReplicationProfileMutationActor {
  userId?: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
}

export interface RemoveCustomReplicationProfileOptions {
  fwCloudId: number;
  actor?: ReplicationProfileMutationActor;
}

export interface ReplicationProfileManagementFailureAuditInput {
  operation: ReplicationProfileManagementOperation;
  fwCloudId: number;
  actor?: ReplicationProfileMutationActor;
  profileId?: number | null;
  profileCode?: string | null;
  profileVersion?: number | null;
  profileName?: string | null;
  sourceProfileId?: number | null;
  sourceProfileCode?: string | null;
  sourceProfileVersion?: number | null;
  sourceProfileIsBuiltin?: boolean | null;
  targetKind?: string | null;
  scope?: string | null;
  category?: string | null;
  reason?: string | null;
  status?: number | null;
  startedAt?: Date;
}

interface ReplicationProfileManagementSuccessAuditInput {
  operation: ReplicationProfileManagementOperation;
  profile: ReplicationProfile;
  startedAt: Date;
  status: number;
  actor?: ReplicationProfileMutationActor;
  sourceProfile?: ReplicationProfile | null;
  previousProfile?: ReplicationProfile | null;
  data?: Record<string, unknown>;
}

export interface ReplicationProfileCatalogFilters {
  fwCloudId: number;
  targetKind?: ReplicationProfileTargetKind;
  origin?: ReplicationProfileCatalogOrigin;
  includeDeprecated?: boolean;
  search?: string;
}

export type CreateCustomReplicationProfileVersionPayload = Omit<
  CreateCustomReplicationProfilePayload,
  'code' | 'version'
>;

interface CustomReplicationProfileIdentity {
  code: string;
  version: number;
}

const DEFAULT_CUSTOM_PROFILE_VERSION = 1;

export class ReplicationProfileService extends Service {
  protected _validationService: ReplicationProfileValidationService;
  protected _auditLogService: AuditLogService;

  public async build(): Promise<ReplicationProfileService> {
    await super.build();
    this._validationService = await this._app.getService<ReplicationProfileValidationService>(
      ReplicationProfileValidationService.name,
    );
    this._auditLogService = await this._app.getService<AuditLogService>(AuditLogService.name);

    return this;
  }

  public validateDefinition(payload: unknown): ReplicationProfileValidationError[] {
    return this._validationService.validate(payload);
  }

  public assertDefinitionIsValid(payload: unknown): void {
    this._validationService.assertValid(payload);
  }

  private get repository(): Repository<ReplicationProfile> {
    return db.getSource().manager.getRepository(ReplicationProfile);
  }

  public async findActive(
    targetKind?: ReplicationProfileTargetKind,
    fwCloudId?: number,
  ): Promise<ReplicationProfile[]> {
    const activeWhere = {
      isActive: true,
      isDeprecated: false,
    };
    const profiles = await this.repository.find({
      where: this.buildFwCloudScopeWhere(activeWhere, fwCloudId),
      order: {
        code: 'ASC',
        version: 'DESC',
      },
    });

    const preferredProfiles = this.preferLatestProfiles(profiles, fwCloudId);

    if (!targetKind) {
      return preferredProfiles;
    }

    return preferredProfiles.filter((profile) => this.supportsTargetKind(profile, targetKind));
  }

  public async findCatalog(
    filters: ReplicationProfileCatalogFilters,
  ): Promise<ReplicationProfile[]> {
    const where: FindOptionsWhere<ReplicationProfile> = {
      isActive: true,
    };

    if (!filters.includeDeprecated) {
      where.isDeprecated = false;
    }

    const profiles = await this.repository.find({
      where: this.buildCatalogWhere(where, filters.fwCloudId, filters.origin ?? 'all'),
      order: {
        code: 'ASC',
        version: 'DESC',
      },
    });

    return this.filterCatalogProfiles(this.preferLatestCatalogProfiles(profiles), filters);
  }

  public async findByCodeAndVersion(
    code: string,
    version: number,
    fwCloudId?: number,
  ): Promise<ReplicationProfile | null> {
    return this.findOneInFwCloudScope(
      {
        code,
        version,
        isActive: true,
        isDeprecated: false,
      },
      fwCloudId,
    );
  }

  public async findAnyByCodeAndVersion(
    code: string,
    version: number,
    fwCloudId?: number,
  ): Promise<ReplicationProfile | null> {
    return this.findOneInFwCloudScope(
      {
        code,
        version,
      },
      fwCloudId,
    );
  }

  private async findOneInFwCloudScope(
    where: FindOptionsWhere<ReplicationProfile>,
    fwCloudId?: number,
  ): Promise<ReplicationProfile | null> {
    if (fwCloudId === undefined) {
      return this.repository.findOne({ where });
    }

    const scopedProfile = await this.repository.findOne({
      where: {
        ...where,
        fwCloudId,
      },
    });

    if (scopedProfile) {
      return scopedProfile;
    }

    return this.repository.findOne({
      where: {
        ...where,
        fwCloudId: IsNull(),
      },
    });
  }

  private buildFwCloudScopeWhere(
    where: FindOptionsWhere<ReplicationProfile>,
    fwCloudId?: number,
  ): FindOptionsWhere<ReplicationProfile> | FindOptionsWhere<ReplicationProfile>[] {
    return fwCloudId === undefined
      ? where
      : [
          { ...where, fwCloudId: IsNull() },
          { ...where, fwCloudId },
        ];
  }

  private buildCatalogWhere(
    where: FindOptionsWhere<ReplicationProfile>,
    fwCloudId: number,
    origin: ReplicationProfileCatalogOrigin,
  ): FindOptionsWhere<ReplicationProfile> | FindOptionsWhere<ReplicationProfile>[] {
    const builtinWhere: FindOptionsWhere<ReplicationProfile> = {
      ...where,
      isBuiltin: true,
      fwCloudId: IsNull(),
    };
    const customWhere: FindOptionsWhere<ReplicationProfile> = {
      ...where,
      isBuiltin: false,
      fwCloudId,
    };

    if (origin === 'builtin') {
      return builtinWhere;
    }

    if (origin === 'custom') {
      return customWhere;
    }

    return [builtinWhere, customWhere];
  }

  public async createCustomProfile(
    payload: CreateCustomReplicationProfilePayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    const code = payload.code ?? this.slugFromName(payload.name);
    const version = payload.version ?? DEFAULT_CUSTOM_PROFILE_VERSION;
    const actor = this.actorFromCreateOptions(options);

    try {
      this.assertPayloadDefinitionIsValid(payload);

      await this.assertCustomProfileIdentityIsAvailable(code, version, options.fwCloudId);

      const profile = await this.persistCustomProfile(payload, options, { code, version });
      await this.auditProfileManagementSuccess({
        operation: 'create',
        profile,
        actor,
        status: 201,
        startedAt,
      });

      return profile;
    } catch (error) {
      await this.auditProfileManagementFailure({
        operation: 'create',
        fwCloudId: options.fwCloudId,
        actor,
        profileCode: code,
        profileVersion: version,
        profileName: payload.name,
        targetKind: payload.targetKind,
        scope: payload.scope,
        category: payload.category,
        reason: this.errorReason(error),
        status: this.statusFromError(error),
        startedAt,
      });

      throw error;
    }
  }

  public async cloneCustomProfile(
    code: string,
    version: number,
    payload: CloneCustomReplicationProfilePayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    const actor = this.actorFromCreateOptions(options);
    let sourceProfile: ReplicationProfile | null = null;
    let targetPayload: CreateCustomReplicationProfilePayload | null = null;

    try {
      sourceProfile = await this.findAnyByCodeAndVersion(code, version, options.fwCloudId);

      if (!sourceProfile) {
        throw new NotFoundException('Replication profile not found');
      }

      if (!sourceProfile.isActive || sourceProfile.isDeprecated) {
        throw new HttpException('Inactive or deprecated profiles cannot be cloned.', 422);
      }

      const cloneCode = payload.code ?? `${sourceProfile.code}-copy`;
      const cloneVersion = DEFAULT_CUSTOM_PROFILE_VERSION;

      await this.assertCustomProfileIdentityIsAvailable(cloneCode, cloneVersion, options.fwCloudId);

      targetPayload = this.buildClonePayload(sourceProfile, payload, cloneCode, cloneVersion);

      this.assertPayloadDefinitionIsValid(targetPayload);

      const profile = await this.persistCustomProfile(targetPayload, options, {
        code: cloneCode,
        version: cloneVersion,
      });

      await this.auditProfileManagementSuccess({
        operation: 'clone',
        profile,
        actor,
        status: 201,
        startedAt,
        sourceProfile,
      });

      return profile;
    } catch (error) {
      await this.auditProfileManagementFailure({
        operation: 'clone',
        fwCloudId: options.fwCloudId,
        actor,
        profileCode: targetPayload?.code ?? payload.code ?? null,
        profileVersion: targetPayload?.version ?? DEFAULT_CUSTOM_PROFILE_VERSION,
        profileName: targetPayload?.name ?? payload.name ?? null,
        sourceProfileId: sourceProfile?.id ?? null,
        sourceProfileCode: sourceProfile?.code ?? code,
        sourceProfileVersion: sourceProfile?.version ?? version,
        sourceProfileIsBuiltin: sourceProfile?.isBuiltin ?? null,
        targetKind: targetPayload?.targetKind ?? payload.targetKind ?? null,
        scope: targetPayload?.scope ?? payload.scope ?? null,
        category: targetPayload?.category ?? payload.category ?? null,
        reason: this.errorReason(error),
        status: this.statusFromError(error),
        startedAt,
      });

      throw error;
    }
  }

  public async createCustomProfileVersion(
    code: string,
    payload: CreateCustomReplicationProfileVersionPayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    const actor = this.actorFromCreateOptions(options);
    let latestCustomProfile: ReplicationProfile | null = null;
    let nextVersion: number | null = null;

    try {
      latestCustomProfile = await this.findLatestCustomProfile(code, options.fwCloudId);

      if (!latestCustomProfile) {
        throw await this.resolveMissingCustomProfileError(
          { code },
          'Built-in profiles cannot be modified through this endpoint.',
        );
      }

      if (!latestCustomProfile.isActive || latestCustomProfile.isDeprecated) {
        throw new HttpException(
          'Inactive or deprecated profiles cannot be modified through this endpoint.',
          422,
        );
      }

      this.assertPayloadDefinitionIsValid(payload);

      nextVersion = latestCustomProfile.version + 1;
      const profile = await this.persistCustomProfile(payload, options, {
        code,
        version: nextVersion,
      });

      await this.auditProfileManagementSuccess({
        operation: 'update',
        profile,
        actor,
        status: 201,
        startedAt,
        previousProfile: latestCustomProfile,
      });

      return profile;
    } catch (error) {
      await this.auditProfileManagementFailure({
        operation: 'update',
        fwCloudId: options.fwCloudId,
        actor,
        profileCode: code,
        profileVersion: nextVersion,
        profileName: payload.name,
        sourceProfileId: latestCustomProfile?.id ?? null,
        sourceProfileCode: latestCustomProfile?.code ?? code,
        sourceProfileVersion: latestCustomProfile?.version ?? null,
        sourceProfileIsBuiltin: latestCustomProfile?.isBuiltin ?? null,
        targetKind: payload.targetKind,
        scope: payload.scope,
        category: payload.category,
        reason: this.errorReason(error),
        status: this.statusFromError(error),
        startedAt,
      });

      throw error;
    }
  }

  public async auditProfileManagementFailure(
    input: ReplicationProfileManagementFailureAuditInput,
  ): Promise<void> {
    const reason = input.reason ?? 'operation failed';
    const actor = input.actor;

    await this._auditLogService.logMutation({
      call: this.auditCallForOperation(input.operation),
      description: this.failureAuditDescription(input, reason),
      status: input.status ?? 403,
      startedAt: input.startedAt,
      userId: actor?.userId ?? null,
      userName: actor?.userName ?? null,
      sessionId: actor?.sessionId ?? null,
      sourceIp: actor?.sourceIp ?? null,
      fwCloudId: input.fwCloudId,
      data: this.failureAuditData(input, reason),
    });
  }

  /**
   * Removes a custom profile from the database so the same code/version can be
   * created again. Built-in profiles cannot be removed (403) and profiles from
   * another FWCloud are indistinguishable from missing ones (404) so their
   * existence is never leaked.
   */
  public async removeCustomProfile(
    code: string,
    version: number,
    options: RemoveCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    let profile: ReplicationProfile | null = null;

    try {
      profile = await this.findOwnedCustomProfile({ code, version }, options.fwCloudId);

      if (!profile) {
        throw await this.resolveMissingCustomProfileError(
          { code, version },
          'Built-in profiles cannot be deleted.',
        );
      }

      const removedProfile = { ...profile } as ReplicationProfile;
      await this.repository.remove(profile);

      await this.auditProfileManagementSuccess({
        operation: 'remove',
        profile: removedProfile,
        actor: options.actor,
        status: 200,
        startedAt,
        data: {
          removed: true,
        },
      });

      return removedProfile;
    } catch (error) {
      await this.auditProfileManagementFailure({
        operation: 'remove',
        fwCloudId: options.fwCloudId,
        actor: options.actor,
        profileId: profile?.id ?? null,
        profileCode: profile?.code ?? code,
        profileVersion: profile?.version ?? version,
        profileName: profile?.name ?? null,
        targetKind: profile?.targetKind ?? null,
        scope: profile?.scope ?? null,
        category: profile?.category ?? null,
        reason: this.errorReason(error),
        status: this.statusFromError(error),
        startedAt,
      });

      throw error;
    }
  }

  /**
   * Builds the error to raise when a custom profile the caller expected to own
   * could not be found: a built-in profile with the same identity yields a 403
   * (built-ins are shared and public), everything else -- including profiles
   * owned by another FWCloud -- yields the generic 404 so their existence is
   * never leaked.
   */
  private async resolveMissingCustomProfileError(
    builtInIdentity: FindOptionsWhere<ReplicationProfile>,
    builtInMessage: string,
  ): Promise<HttpException> {
    const builtInExists = await this.repository.exists({
      where: {
        ...builtInIdentity,
        fwCloudId: IsNull(),
        isBuiltin: true,
      },
    });

    return builtInExists
      ? new HttpException(builtInMessage, 403)
      : new NotFoundException('Replication profile not found');
  }

  private async assertCustomProfileIdentityIsAvailable(
    code: string,
    version: number,
    fwCloudId: number,
  ): Promise<void> {
    const existingProfile = await this.repository.findOne({
      where: {
        code,
        version,
        fwCloudId,
      },
    });

    if (!existingProfile) {
      return;
    }

    if (this.canReuseCustomProfileIdentity(existingProfile)) {
      await this.repository.remove(existingProfile);
      return;
    }

    throw new HttpException(
      `Replication profile "${code}" (version ${version}) already exists in this FWCloud.`,
      409,
    );
  }

  private findLatestCustomProfile(
    code: string,
    fwCloudId: number,
  ): Promise<ReplicationProfile | null> {
    return this.findOwnedCustomProfile({ code }, fwCloudId, { version: 'DESC' });
  }

  private findOwnedCustomProfile(
    where: FindOptionsWhere<ReplicationProfile>,
    fwCloudId: number,
    order?: FindOptionsOrder<ReplicationProfile>,
  ): Promise<ReplicationProfile | null> {
    return this.repository.findOne({
      where: {
        ...where,
        fwCloudId,
        isBuiltin: false,
      },
      ...(order ? { order } : {}),
    });
  }

  private canReuseCustomProfileIdentity(profile: ReplicationProfile): boolean {
    return !profile.isBuiltin && (!profile.isActive || profile.isDeprecated);
  }

  private buildClonePayload(
    sourceProfile: ReplicationProfile,
    payload: CloneCustomReplicationProfilePayload,
    code: string,
    version: number,
  ): CreateCustomReplicationProfilePayload {
    return {
      name: payload.name ?? `${sourceProfile.name} copy`,
      description: payload.description ?? sourceProfile.description,
      code,
      version,
      scope: payload.scope ?? sourceProfile.scope,
      targetKind: payload.targetKind ?? sourceProfile.targetKind,
      category: payload.category ?? sourceProfile.category,
      model: this.cloneProfileModel(sourceProfile.model),
    };
  }

  private async auditProfileManagementSuccess(
    input: ReplicationProfileManagementSuccessAuditInput,
  ): Promise<void> {
    const actor = input.actor;

    await this._auditLogService.logMutation({
      call: this.auditCallForOperation(input.operation),
      description: this.successAuditDescription(input),
      status: input.status,
      startedAt: input.startedAt,
      userId: actor?.userId ?? null,
      userName: actor?.userName ?? null,
      sessionId: actor?.sessionId ?? null,
      sourceIp: actor?.sourceIp ?? null,
      fwCloudId: input.profile.fwCloudId,
      data: this.cleanAuditData({
        operation: input.operation,
        result: 'success',
        ...this.profileAuditData(input.profile),
        ...this.sourceProfileAuditData(input.sourceProfile),
        ...this.previousProfileAuditData(input.previousProfile),
        ...input.data,
      }),
    });
  }

  private auditCallForOperation(operation: ReplicationProfileManagementOperation): string {
    switch (operation) {
      case 'create':
        return PROFILE_CREATE_AUDIT_CALL;
      case 'clone':
        return PROFILE_CLONE_AUDIT_CALL;
      case 'update':
        return PROFILE_VERSION_AUDIT_CALL;
      case 'remove':
        return PROFILE_REMOVE_AUDIT_CALL;
    }
  }

  private successAuditDescription(input: ReplicationProfileManagementSuccessAuditInput): string {
    if (input.operation === 'create') {
      return `Custom assistant profile ${input.profile.code} v${input.profile.version} created.`;
    }

    if (input.operation === 'clone') {
      const source = input.sourceProfile;
      const sourceLabel = source
        ? `${source.code} v${source.version}`
        : 'selected assistant profile';

      return `Assistant profile ${sourceLabel} cloned as custom profile ${input.profile.code} v${input.profile.version}.`;
    }

    if (input.operation === 'remove') {
      return `Custom assistant profile ${input.profile.code} v${input.profile.version} removed.`;
    }

    return `Custom assistant profile ${input.profile.code} updated by creating version ${input.profile.version}.`;
  }

  private failureAuditData(
    input: ReplicationProfileManagementFailureAuditInput,
    reason: string,
  ): Record<string, unknown> {
    return this.cleanAuditData({
      operation: input.operation,
      result: 'failure',
      errorReason: reason,
      profileId: input.profileId,
      profileCode: input.profileCode,
      profileVersion: input.profileVersion,
      profileName: input.profileName,
      sourceProfileId: input.sourceProfileId,
      sourceProfileCode: input.sourceProfileCode,
      sourceProfileVersion: input.sourceProfileVersion,
      sourceProfileIsBuiltin: input.sourceProfileIsBuiltin,
      fwCloudId: input.fwCloudId,
      targetKind: input.targetKind,
      scope: input.scope,
      category: input.category,
    });
  }

  private profileAuditData(profile: ReplicationProfile): Record<string, unknown> {
    return {
      profileId: profile.id,
      profileCode: profile.code,
      profileVersion: profile.version,
      profileName: profile.name,
      fwCloudId: profile.fwCloudId,
      targetKind: profile.targetKind,
      scope: profile.scope,
      category: profile.category,
    };
  }

  private sourceProfileAuditData(
    profile: ReplicationProfile | null | undefined,
  ): Record<string, unknown> {
    return profile
      ? {
          sourceProfileId: profile.id,
          sourceProfileCode: profile.code,
          sourceProfileVersion: profile.version,
          sourceProfileIsBuiltin: profile.isBuiltin,
        }
      : {};
  }

  private previousProfileAuditData(
    profile: ReplicationProfile | null | undefined,
  ): Record<string, unknown> {
    return profile
      ? {
          previousProfileId: profile.id,
          previousProfileVersion: profile.version,
        }
      : {};
  }

  private failureAuditDescription(
    input: ReplicationProfileManagementFailureAuditInput,
    reason: string,
  ): string {
    const profileLabel = this.profileAuditLabel(input.profileCode, input.profileVersion);
    const sourceLabel = this.profileAuditLabel(input.sourceProfileCode, input.sourceProfileVersion);

    switch (input.operation) {
      case 'create':
        return `Failed to create custom assistant profile ${profileLabel}: ${reason}.`;
      case 'clone':
        return `Failed to clone assistant profile ${sourceLabel}: ${reason}.`;
      case 'update':
        return `Failed to update custom assistant profile ${profileLabel}: ${reason}.`;
      case 'remove':
        return `Failed to remove custom assistant profile ${profileLabel}: ${reason}.`;
    }
  }

  private profileAuditLabel(code?: string | null, version?: number | null): string {
    if (!code) {
      return 'profile';
    }

    return version ? `${code} v${version}` : code;
  }

  private actorFromCreateOptions(
    options: CreateCustomReplicationProfileOptions,
  ): ReplicationProfileMutationActor | undefined {
    if (options.actor) {
      return options.actor;
    }

    return options.userId !== undefined ? { userId: options.userId } : undefined;
  }

  private statusFromError(error: unknown): number {
    return error instanceof HttpException && Number.isFinite(error.status) ? error.status : 500;
  }

  private errorReason(error: unknown): string {
    if (error instanceof HttpException && typeof error.message === 'string') {
      const message = error.message.trim();
      return message.length > 0 ? message : 'operation failed';
    }

    return 'operation failed';
  }

  private cloneProfileModel(
    model: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    return JSON.parse(JSON.stringify(model ?? {}));
  }

  private cleanAuditData(data: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined),
    ) as Record<string, unknown>;
  }

  public slugFromName(name: string): string {
    const slug = name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    return slug.length > 0 ? slug : 'profile';
  }

  public supportsTargetKind(
    profile: ReplicationProfile,
    targetKind: ReplicationProfileTargetKind,
  ): boolean {
    const compatibleTargetKinds = new Set<ReplicationProfileTargetKind>([
      ...normalizeReplicationProfileTargetKinds(profile.targetKind),
      ...getReplicationProfileModelTargetKinds(profile.model),
    ]);

    return compatibleTargetKinds.has(targetKind);
  }

  private preferLatestProfiles(
    profiles: ReplicationProfile[],
    fwCloudId?: number,
  ): ReplicationProfile[] {
    return this.preferLatestByKey(
      profiles,
      (profile) =>
        fwCloudId === undefined ? `${profile.fwCloudId ?? 'global'}:${profile.code}` : profile.code,
      (candidate, current) => this.isPreferredProfile(candidate, current, fwCloudId),
    ).sort((left, right) => this.compareScopedProfiles(left, right));
  }

  private isPreferredProfile(
    candidate: ReplicationProfile,
    current: ReplicationProfile,
    fwCloudId?: number,
  ): boolean {
    if (fwCloudId !== undefined) {
      const candidateIsOwned = candidate.fwCloudId === fwCloudId;
      const currentIsOwned = current.fwCloudId === fwCloudId;

      if (candidateIsOwned !== currentIsOwned) {
        return candidateIsOwned;
      }
    }

    return candidate.version > current.version;
  }

  private preferLatestCatalogProfiles(profiles: ReplicationProfile[]): ReplicationProfile[] {
    return this.preferLatestByKey(
      profiles,
      (profile) =>
        `${profile.isBuiltin ? 'builtin' : `custom:${profile.fwCloudId}`}:${profile.code}`,
      (candidate, current) => candidate.version > current.version,
    ).sort((left, right) => this.compareCatalogProfiles(left, right));
  }

  private filterCatalogProfiles(
    profiles: ReplicationProfile[],
    filters: ReplicationProfileCatalogFilters,
  ): ReplicationProfile[] {
    const search = filters.search?.trim().toLowerCase();

    return profiles.filter(
      (profile) =>
        (!filters.targetKind || this.supportsTargetKind(profile, filters.targetKind)) &&
        (!search || this.matchesCatalogSearch(profile, search)),
    );
  }

  private preferLatestByKey(
    profiles: ReplicationProfile[],
    keyFor: (profile: ReplicationProfile) => string,
    isPreferred: (candidate: ReplicationProfile, current: ReplicationProfile) => boolean,
  ): ReplicationProfile[] {
    const preferredProfiles = new Map<string, ReplicationProfile>();

    for (const profile of profiles) {
      const key = keyFor(profile);
      const current = preferredProfiles.get(key);

      if (!current || isPreferred(profile, current)) {
        preferredProfiles.set(key, profile);
      }
    }

    return Array.from(preferredProfiles.values());
  }

  private compareScopedProfiles(left: ReplicationProfile, right: ReplicationProfile): number {
    const codeOrder = left.code.localeCompare(right.code);
    if (codeOrder !== 0) {
      return codeOrder;
    }

    const leftNamespace = left.fwCloudId ?? 0;
    const rightNamespace = right.fwCloudId ?? 0;
    if (leftNamespace !== rightNamespace) {
      return leftNamespace - rightNamespace;
    }

    return right.version - left.version;
  }

  private compareCatalogProfiles(left: ReplicationProfile, right: ReplicationProfile): number {
    const codeOrder = left.code.localeCompare(right.code);
    if (codeOrder !== 0) {
      return codeOrder;
    }

    const originOrder = Number(right.isBuiltin) - Number(left.isBuiltin);
    if (originOrder !== 0) {
      return originOrder;
    }

    return right.version - left.version;
  }

  private matchesCatalogSearch(profile: ReplicationProfile, search: string): boolean {
    return [profile.name, profile.description, profile.code, profile.category].some((value) =>
      (value ?? '').toLowerCase().includes(search),
    );
  }

  private assertPayloadDefinitionIsValid(
    payload: CreateCustomReplicationProfileVersionPayload,
  ): void {
    this.assertDefinitionIsValid({
      targetKind: payload.targetKind ?? DEFAULT_CUSTOM_PROFILE_TARGET_KIND,
      model: payload.model,
    });
  }

  private persistCustomProfile(
    payload: CreateCustomReplicationProfileVersionPayload,
    options: CreateCustomReplicationProfileOptions,
    identity: CustomReplicationProfileIdentity,
  ): Promise<ReplicationProfile> {
    const userId = options.actor?.userId ?? options.userId ?? null;
    const now = new Date();
    const profile = this.repository.create({
      code: identity.code,
      version: identity.version,
      name: payload.name,
      description: payload.description ?? null,
      scope: payload.scope,
      targetKind: this.effectiveProfileTargetKind(payload.targetKind),
      model: payload.model as Record<string, unknown>,
      category: payload.category ?? null,
      isBuiltin: false,
      isActive: true,
      isDeprecated: false,
      fwCloudId: options.fwCloudId,
      created_by: userId,
      updated_by: userId,
      created_at: now,
      updated_at: now,
    });

    return this.repository.save(profile);
  }

  private effectiveProfileTargetKind(targetKind: string | undefined): ReplicationProfileTargetKind {
    return isReplicationProfileStringValue(targetKind, REPLICATION_PROFILE_TARGET_KINDS)
      ? targetKind
      : DEFAULT_CUSTOM_PROFILE_TARGET_KIND;
  }
}
