import db from '../../database/database-manager';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Service } from '../../fonaments/services/service';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
import { ReplicationProfile } from './replication-profile.model';
import {
  type ReplicationProfileCatalogOrigin,
  getReplicationProfileModelTargetKinds,
  normalizeReplicationProfileTargetKinds,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';
import {
  ReplicationProfileValidationError,
  ReplicationProfileValidationService,
} from './replication-profile-validation.service';
import { AuditLogService } from '../audit/AuditLog.service';

export const PROFILE_DEACTIVATION_AUDIT_CALL = 'assistant.profiles.deactivate';

export interface CreateCustomReplicationProfilePayload {
  name: string;
  description?: string | null;
  code?: string;
  version?: number;
  scope: string;
  targetKind: string;
  category?: string | null;
  model: unknown;
}

export interface CreateCustomReplicationProfileOptions {
  fwCloudId: number;
  userId?: number | null;
}

/** Identity of the user requesting a mutation, used to enrich the audit trail. */
export interface ReplicationProfileMutationActor {
  userId?: number | null;
  userName?: string | null;
  sessionId?: number | null;
  sourceIp?: string | null;
}

export interface DeactivateCustomReplicationProfileOptions {
  fwCloudId: number;
  actor?: ReplicationProfileMutationActor;
}

interface ReplicationProfileActiveState {
  isActive: boolean;
  isDeprecated: boolean;
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
    const code = payload.code ?? this.slugFromName(payload.name);
    const version = payload.version ?? DEFAULT_CUSTOM_PROFILE_VERSION;

    this.assertPayloadDefinitionIsValid(payload);

    const alreadyExists = await this.repository.exists({
      where: {
        code,
        version,
        fwCloudId: options.fwCloudId,
      },
    });

    if (alreadyExists) {
      throw new HttpException(
        `Replication profile "${code}" (version ${version}) already exists in this FWCloud.`,
        409,
      );
    }

    return this.persistCustomProfile(payload, options, { code, version });
  }

  public async createCustomProfileVersion(
    code: string,
    payload: CreateCustomReplicationProfileVersionPayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const latestCustomProfile = await this.repository.findOne({
      where: {
        code,
        fwCloudId: options.fwCloudId,
        isBuiltin: false,
      },
      order: {
        version: 'DESC',
      },
    });

    if (!latestCustomProfile) {
      throw await this.resolveMissingCustomProfileError(
        { code },
        'Built-in profiles cannot be modified through this endpoint.',
      );
    }

    this.assertPayloadDefinitionIsValid(payload);

    return this.persistCustomProfile(payload, options, {
      code,
      version: latestCustomProfile.version + 1,
    });
  }

  /**
   * Soft-deletes a custom profile: the row is preserved but flagged as
   * inactive/deprecated so it disappears from the catalog and can no longer be
   * applied. Built-in profiles cannot be deactivated (403) and profiles from
   * another FWCloud are indistinguishable from missing ones (404) so their
   * existence is never leaked.
   */
  public async deactivateCustomProfile(
    code: string,
    version: number,
    options: DeactivateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();

    const profile = await this.repository.findOne({
      where: {
        code,
        version,
        fwCloudId: options.fwCloudId,
        isBuiltin: false,
      },
    });

    if (!profile) {
      throw await this.resolveMissingCustomProfileError(
        { code, version },
        'Built-in profiles cannot be deleted or deactivated.',
      );
    }

    const previousState: ReplicationProfileActiveState = {
      isActive: profile.isActive,
      isDeprecated: profile.isDeprecated,
    };

    profile.isActive = false;
    profile.isDeprecated = true;
    profile.updated_by = options.actor?.userId ?? profile.updated_by ?? null;

    const saved = await this.repository.save(profile);

    await this.auditDeactivation(saved, previousState, options, startedAt);

    return saved;
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

  private async auditDeactivation(
    profile: ReplicationProfile,
    previousState: ReplicationProfileActiveState,
    options: DeactivateCustomReplicationProfileOptions,
    startedAt: Date,
  ): Promise<void> {
    const actor = options.actor;

    await this._auditLogService.logMutation({
      call: PROFILE_DEACTIVATION_AUDIT_CALL,
      description: `Custom assistant profile ${profile.code} v${profile.version} deactivated.`,
      status: 200,
      startedAt,
      userId: actor?.userId ?? null,
      userName: actor?.userName ?? null,
      sessionId: actor?.sessionId ?? null,
      sourceIp: actor?.sourceIp ?? null,
      fwCloudId: profile.fwCloudId,
      data: {
        profileId: profile.id,
        profileCode: profile.code,
        profileVersion: profile.version,
        profileName: profile.name,
        fwCloudId: profile.fwCloudId,
        operation: 'deactivate',
        previous: previousState,
        current: {
          isActive: profile.isActive,
          isDeprecated: profile.isDeprecated,
        },
      },
    });
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
      targetKind: payload.targetKind,
      model: payload.model,
    });
  }

  private persistCustomProfile(
    payload: CreateCustomReplicationProfileVersionPayload,
    options: CreateCustomReplicationProfileOptions,
    identity: CustomReplicationProfileIdentity,
  ): Promise<ReplicationProfile> {
    const userId = options.userId ?? null;
    const now = new Date();
    const profile = this.repository.create({
      code: identity.code,
      version: identity.version,
      name: payload.name,
      description: payload.description ?? null,
      scope: payload.scope,
      targetKind: payload.targetKind as ReplicationProfileTargetKind,
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
}
