import db from '../../database/database-manager';
import { HttpException } from '../../fonaments/exceptions/http/http-exception';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Service } from '../../fonaments/services/service';
import { FindOptionsWhere, In, IsNull, Repository } from 'typeorm';
import { ReplicationProfile } from './replication-profile.model';
import {
  type ReplicationProfileCatalogOrigin,
  getReplicationProfileModelTargetKinds,
  isReplicationProfileOwnerId,
  isReplicationProfileStringValue,
  normalizeReplicationProfileTargetKinds,
  REPLICATION_PROFILE_TARGET_KINDS,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';
import {
  ReplicationProfileValidationException,
  ReplicationProfileValidationError,
  ReplicationProfileValidationService,
} from './replication-profile-validation.service';
import {
  buildReplicationProfileTemplatePath,
  loadReplicationProfileModel,
  readReplicationProfileModel,
  ReplicationProfileTemplateException,
  type ReplicationProfileModel,
  type ReplicationProfileTemplateRead,
  type ReplicationProfileVersionSlot,
} from './replication-profile-template';
import { captureProfileObjectReferences } from './replication-profile-object-reference.service';
import { AuditLogService } from '../audit/AuditLog.service';
import {
  assertReplicationProfileCode,
  assertReplicationProfileName,
  firstFreeReplicationProfileValue,
  replicationProfileNameKey,
  replicationProfileNameTakenException,
} from './replication-profile-name';
import { replicationProfileTransaction } from './replication-profile-transaction';
import {
  parseReplicationProfileDocument,
  portableProfileMetadata,
  portableProfileModel,
  REPLICATION_PROFILE_FORMAT,
  REPLICATION_PROFILE_FORMAT_VERSION,
  ReplicationProfileImportConflictException,
  type ReplicationProfilePortableDocument,
} from './replication-profile-portable';
import {
  getProfileObjectReferences,
  getProfileReferenceIpObjType,
} from './replication-profile-object-reference';
import { validateProfileObjectSnapshot } from './replication-profile-object-snapshot';

export const PROFILE_CREATE_AUDIT_CALL = 'profiles.create';
export const PROFILE_CLONE_AUDIT_CALL = 'profiles.clone';
export const PROFILE_VERSION_AUDIT_CALL = 'profiles.version';
export const PROFILE_ROLLBACK_AUDIT_CALL = 'profiles.rollback';
export const PROFILE_REMOVE_AUDIT_CALL = 'profiles.remove';
export const DEFAULT_CUSTOM_PROFILE_TARGET_KIND: ReplicationProfileTargetKind = 'firewall';

export type ReplicationProfileManagementOperation =
  'create' | 'clone' | 'update' | 'remove' | 'rollback';

export interface CreateCustomReplicationProfilePayload {
  name: string;
  description?: string | null;
  code?: string;
  version?: number | 'latest';
  scope: string;
  targetKind?: string;
  category?: string | null;
  model: unknown;
}

export interface CreateCustomReplicationProfileOptions {
  /** FWCloud the request is made from: recorded as where the profile was created and audited. */
  fwCloudId: number;
  /** Owner of the profile, when no actor carries it. */
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

export interface RemoveCustomReplicationProfileOptions extends CreateCustomReplicationProfileOptions {
  /** Remove every version of this code owned by the requesting user. */
  allVersions?: boolean;
}

/**
 * A profile with its template already read. Listings and removals report a
 * broken template here instead of failing because of it.
 */
export interface ReplicationProfileWithTemplate {
  profile: ReplicationProfile;
  template: ReplicationProfileTemplateRead;
}

export interface ReplicationProfileManagementFailureAuditInput {
  operation: ReplicationProfileManagementOperation;
  fwCloudId: number;
  actor?: ReplicationProfileMutationActor;
  profileId?: number | null;
  profileCode?: string | null;
  profileVersion?: number | ReplicationProfileVersionSlot | null;
  profileName?: string | null;
  sourceProfileId?: number | null;
  sourceProfileCode?: string | null;
  sourceProfileVersion?: number | ReplicationProfileVersionSlot | null;
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
  /** FWCloud the operation was requested from, not necessarily where the profile was created. */
  fwCloudId: number;
  profile: ReplicationProfile;
  startedAt: Date;
  status: number;
  actor?: ReplicationProfileMutationActor;
  sourceProfile?: ReplicationProfile | null;
  previousProfile?: ReplicationProfile | null;
  /** What a removal took away: the requested version or, with allVersions, every one. */
  removal?: { allVersions: boolean; versions: number[] };
}

export interface ReplicationProfileCatalogFilters {
  /** User whose custom profiles are listed with the built-in ones, whatever the FWCloud. */
  userId: number | null;
  targetKind?: ReplicationProfileTargetKind;
  origin?: ReplicationProfileCatalogOrigin;
  includeDeprecated?: boolean;
  search?: string;
}

export type CreateCustomReplicationProfileVersionPayload = Omit<
  CreateCustomReplicationProfilePayload,
  'code' | 'version'
>;

/** What a payload defines: the part of it the validation checks. */
type ProfileDefinitionPayload = Pick<
  CreateCustomReplicationProfileVersionPayload,
  'targetKind' | 'model'
>;

interface CustomReplicationProfileIdentity {
  code: string;
  version: number;
  userId: number;
}

interface CustomReplicationProfilePersistenceOptions {
  freeCode?: boolean;
  freeName?: boolean;
  rejectExisting?: boolean;
  previous?: CreateCustomReplicationProfileVersionPayload;
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

  /** Errors of a payload validated as it would be saved from the given FWCloud. */
  public async validatePayloadToSave(
    payload: ProfileDefinitionPayload,
    fwCloudId: number,
  ): Promise<ReplicationProfileValidationError[]> {
    return this.validateDefinition(
      this.payloadDefinition(await this.captureObjectReferences(payload, fwCloudId)),
    );
  }

  private get repository(): Repository<ReplicationProfile> {
    return db.getSource().manager.getRepository(ReplicationProfile);
  }

  /**
   * Catalog profiles with their templates read once, for both the target kind
   * filter and the response. A profile whose template cannot be read is still
   * listed, carrying the error, so it does not hide the valid ones.
   */
  public async findCatalog(
    filters: ReplicationProfileCatalogFilters,
  ): Promise<ReplicationProfileWithTemplate[]> {
    const where: FindOptionsWhere<ReplicationProfile> = {
      isActive: true,
      versionSlot: 'latest',
    };

    if (!filters.includeDeprecated) {
      where.isDeprecated = false;
    }

    const scopes = this.buildProfileScopes(where, filters.userId, filters.origin ?? 'all');

    // Without conditions the query would return the profiles of every user.
    if (scopes.length === 0) {
      return [];
    }

    const profiles = await this.repository.find({ where: scopes });

    // Sort once, including the built-in/custom precedence that SQL ordering did not cover.
    return this.filterCatalogProfiles(
      profiles.sort((left, right) => this.compareCatalogProfiles(left, right)),
      filters,
    );
  }

  public async findByCodeAndVersion(
    code: string,
    version: number | ReplicationProfileVersionSlot,
    userId?: number | null,
  ): Promise<ReplicationProfile | null> {
    return this.findOneInUserScope(
      {
        code,
        ...this.versionWhere(version),
        isActive: true,
        isDeprecated: false,
      },
      userId,
    );
  }

  public async findAnyByCodeAndVersion(
    code: string,
    version: number | ReplicationProfileVersionSlot,
    userId?: number | null,
  ): Promise<ReplicationProfile | null> {
    return this.findOneInUserScope(
      {
        code,
        ...this.versionWhere(version),
      },
      userId,
    );
  }

  /**
   * A custom profile of the user takes precedence over a built-in one with the
   * same code and version. Without a user only the built-in ones are searched,
   * so the custom profiles of somebody else are never reached.
   */
  private findOneInUserScope(
    where: FindOptionsWhere<ReplicationProfile>,
    userId?: number | null,
  ): Promise<ReplicationProfile | null> {
    return this.repository.findOne({
      where: this.buildProfileScopes(where, userId, 'all'),
      order: { isBuiltin: 'ASC' },
    });
  }

  /**
   * The catalog of a user is made of the built-in profiles and the custom ones
   * they own. The FWCloud the catalog is requested from does not narrow it.
   */
  private buildProfileScopes(
    where: FindOptionsWhere<ReplicationProfile>,
    userId: number | null | undefined,
    origin: ReplicationProfileCatalogOrigin,
  ): FindOptionsWhere<ReplicationProfile>[] {
    const scopes: FindOptionsWhere<ReplicationProfile>[] = [];

    if (origin !== 'custom') {
      scopes.push({ ...where, isBuiltin: true, userId: IsNull() });
    }

    if (origin !== 'builtin' && isReplicationProfileOwnerId(userId)) {
      scopes.push(this.ownedCustomProfileWhere(where, userId));
    }

    return scopes;
  }

  public async createCustomProfile(
    payload: CreateCustomReplicationProfilePayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    const code = payload.code ?? this.slugFromName(payload.name);
    const version = DEFAULT_CUSTOM_PROFILE_VERSION;
    const actor = this.actorFromMutationOptions(options);

    try {
      const userId = this.requireOwnerUserId(options);
      assertReplicationProfileName(payload.name);
      assertReplicationProfileCode(code);
      payload = await this.captureObjectReferences(payload, options.fwCloudId);
      this.assertPayloadDefinitionIsValid(payload);

      const profile = await this.persistCustomProfile(
        payload,
        options,
        { code, version, userId },
        { freeCode: !payload.code },
      );
      await this.auditProfileManagementSuccess({
        operation: 'create',
        fwCloudId: options.fwCloudId,
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

  /** Load the stored models, without the destination-specific object resolution used by show(). */
  public async exportProfile(
    code: string,
    userId: number | null,
  ): Promise<ReplicationProfilePortableDocument> {
    const latest = await this.findAnyByCodeAndVersion(code, 'latest', userId);
    if (!latest) throw new NotFoundException('Replication profile not found');
    // Match the owner and origin of latest, never a same-code version of a different template.
    const previous = await this.repository.findOne({
      where: {
        code: latest.code,
        userId: latest.userId ?? IsNull(),
        isBuiltin: latest.isBuiltin,
        versionSlot: 'previous',
      },
    });
    try {
      const document: ReplicationProfilePortableDocument = {
        format: REPLICATION_PROFILE_FORMAT,
        formatVersion: REPLICATION_PROFILE_FORMAT_VERSION,
        profile: portableProfileMetadata(latest),
        versions: {
          latest: { model: portableProfileModel(loadReplicationProfileModel(latest)) },
        },
      };
      if (previous) {
        document.versions.previous = {
          metadata: portableProfileMetadata(previous),
          model: portableProfileModel(loadReplicationProfileModel(previous)),
        };
      }
      return document;
    } catch (error) {
      // Loader diagnostics may contain paths or JSON parser excerpts from a damaged file.
      if (error instanceof ReplicationProfileTemplateException)
        throw new HttpException('Replication profile template could not be exported.', 500);
      throw error;
    }
  }

  public async importProfile(
    input: unknown,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const userId = this.requireOwnerUserId(options);
    const document = parseReplicationProfileDocument(input);
    // Snapshot checks reuse the object APIs' validators, with destination lookups disabled.
    // Unlike create/edit, importing must never recapture snapshots through source database ids.
    for (const version of [document.versions.latest, document.versions.previous]) {
      if (!version) continue;
      for (const [index, reference] of getProfileObjectReferences(version.model).entries()) {
        const error = await validateProfileObjectSnapshot(
          reference.snapshot,
          getProfileReferenceIpObjType(reference.objectType),
          options.fwCloudId,
          { checkDestination: false },
        );
        if (error)
          throw new ReplicationProfileValidationException([
            {
              code: 'invalid_object_reference',
              message: error,
              path: `model.objectReferences[${index}].snapshot`,
              severity: 'error',
            },
          ]);
      }
    }
    const previous = document.versions.previous;
    return this.persistCustomProfile(
      { ...document.profile, model: document.versions.latest.model },
      options,
      { code: document.profile.code, version: previous ? 2 : 1, userId },
      {
        rejectExisting: true,
        previous: previous
          ? { ...(previous.metadata ?? document.profile), model: previous.model }
          : undefined,
      },
    );
  }

  public async cloneCustomProfile(
    code: string,
    version: number | ReplicationProfileVersionSlot,
    payload: CloneCustomReplicationProfilePayload,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    const actor = this.actorFromMutationOptions(options);
    let sourceProfile: ReplicationProfile | null = null;
    let targetPayload: CreateCustomReplicationProfilePayload | null = null;

    try {
      const userId = this.requireOwnerUserId(options);
      sourceProfile = await this.findAnyByCodeAndVersion(code, version, userId);

      if (!sourceProfile) {
        throw new NotFoundException('Replication profile not found');
      }

      if (!sourceProfile.isActive || sourceProfile.isDeprecated) {
        throw new HttpException('Inactive or deprecated profiles cannot be cloned.', 422);
      }

      const cloneCode =
        payload.code ?? `${sourceProfile.code.replace(/\./g, '-').slice(0, 250)}-copy`;
      const cloneVersion = DEFAULT_CUSTOM_PROFILE_VERSION;

      assertReplicationProfileCode(cloneCode);

      targetPayload = this.buildClonePayload(sourceProfile, payload, cloneCode, cloneVersion);

      assertReplicationProfileName(targetPayload.name);
      this.assertPayloadDefinitionIsValid(targetPayload);

      const profile = await this.persistCustomProfile(
        targetPayload,
        options,
        { code: cloneCode, version: cloneVersion, userId },
        { freeCode: !payload.code, freeName: !payload.name },
      );

      await this.auditProfileManagementSuccess({
        operation: 'clone',
        fwCloudId: options.fwCloudId,
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
    const actor = this.actorFromMutationOptions(options);
    let nextVersion: number | null = null;

    try {
      this.requireOwnerUserId(options);
      assertReplicationProfileName(payload.name);
      payload = await this.captureObjectReferences(payload, options.fwCloudId);
      this.assertPayloadDefinitionIsValid(payload);
      const { profile, previousProfile } = await this.rotateCustomProfile(code, options, payload);
      nextVersion = profile.version;

      await this.auditProfileManagementSuccess({
        operation: 'update',
        fwCloudId: options.fwCloudId,
        profile,
        previousProfile,
        actor,
        status: 201,
        startedAt,
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
        sourceProfileId: null,
        sourceProfileCode: code,
        sourceProfileVersion: null,
        sourceProfileIsBuiltin: false,
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

  public async rollbackCustomProfile(
    code: string,
    options: CreateCustomReplicationProfileOptions,
  ): Promise<ReplicationProfile> {
    const startedAt = new Date();
    const actor = this.actorFromMutationOptions(options);
    try {
      const { profile, previousProfile } = await this.rotateCustomProfile(code, options);
      await this.auditProfileManagementSuccess({
        operation: 'rollback',
        fwCloudId: options.fwCloudId,
        profile,
        previousProfile,
        actor,
        status: 200,
        startedAt,
      });
      return profile;
    } catch (error) {
      await this.auditProfileManagementFailure({
        operation: 'rollback',
        fwCloudId: options.fwCloudId,
        actor,
        profileCode: code,
        reason: this.errorReason(error),
        status: this.statusFromError(error),
        startedAt,
      });
      throw error;
    }
  }

  public async hasPreviousVersion(profile: ReplicationProfile): Promise<boolean> {
    const [hasPrevious] = await this.hasPreviousVersions([profile]);

    return hasPrevious;
  }

  /** Whether each profile keeps a previous version, read with a single query. */
  public async hasPreviousVersions(profiles: ReplicationProfile[]): Promise<boolean[]> {
    if (profiles.length === 0) {
      return [];
    }

    // Codes are compared case-insensitively, as the database compares them.
    const key = (profile: ReplicationProfile): string =>
      `${profile.isBuiltin ? 1 : 0}:${profile.userId ?? 0}:${profile.code.toLowerCase()}`;
    const previous = await this.repository.find({
      select: { code: true, userId: true, isBuiltin: true },
      where: { versionSlot: 'previous', code: In([...new Set(profiles.map(({ code }) => code))]) },
    });
    const keys = new Set(previous.map(key));

    return profiles.map((profile) => keys.has(key(profile)));
  }

  private versionWhere(
    version: number | ReplicationProfileVersionSlot,
  ): FindOptionsWhere<ReplicationProfile> {
    return typeof version === 'number' ? { version } : { versionSlot: version };
  }

  /** Saves `payload` as the new latest version or, without one, restores the previous version. */
  private async rotateCustomProfile(
    code: string,
    options: CreateCustomReplicationProfileOptions,
    payload?: CreateCustomReplicationProfileVersionPayload,
  ): Promise<{ profile: ReplicationProfile; previousProfile: ReplicationProfile }> {
    const userId = this.requireOwnerUserId(options);
    return replicationProfileTransaction(userId, async (manager, files) => {
      const repository = manager.getRepository(ReplicationProfile);
      const profiles = await repository.find({
        where: this.ownedCustomProfileWhere({ code }, userId),
      });
      const latest = profiles.find((profile) => profile.versionSlot === 'latest');
      const previous = profiles.find((profile) => profile.versionSlot === 'previous');
      if (!latest)
        throw await this.resolveMissingCustomProfileError(
          { code },
          'Built-in profiles cannot be modified through this endpoint.',
          repository,
        );
      if (!latest.isActive || latest.isDeprecated)
        throw new HttpException(
          'Inactive or deprecated profiles cannot be modified through this endpoint.',
          422,
        );
      if (!payload && !previous)
        throw new HttpException('No previous template version exists.', 409);
      const latestModel = loadReplicationProfileModel(latest);
      const model = payload ? payload.model : loadReplicationProfileModel(previous!);
      const metadata = payload ?? previous!;
      // A restored version takes the current name: the name belongs to the template.
      const name = payload ? payload.name : latest.name;
      assertReplicationProfileName(name);
      const nameKey = replicationProfileNameKey(name);
      if (
        nameKey !== replicationProfileNameKey(latest.name) &&
        this.currentNameKeys(
          await repository.find({ where: this.ownedCustomProfileWhere({}, userId) }),
          latest.code,
        ).has(nameKey)
      )
        throw replicationProfileNameTakenException();
      this.assertDefinitionIsValid({ targetKind: metadata.targetKind ?? latest.targetKind, model });
      const formerLatest = { ...latest };
      // Advance the internal revision before reusing its value on the previous row.
      // Applied object bindings still refer to their original numeric revision.
      Object.assign(latest, {
        ...this.profileMetadata(metadata, name),
        version: Math.max(...profiles.map((profile) => profile.version)) + 1,
        updated_at: new Date(),
        updated_by: userId,
      });
      latest.path = buildReplicationProfileTemplatePath(latest);
      const saved = await repository.save(latest);
      const preceding = repository.create({
        ...formerLatest,
        id: previous?.id,
        versionSlot: 'previous',
        path: buildReplicationProfileTemplatePath({ ...formerLatest, versionSlot: 'previous' }),
      });
      await repository.save(preceding);
      files.rotate(saved, model, preceding, latestModel);
      return { profile: saved, previousProfile: formerLatest as ReplicationProfile };
    });
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
   * Removes a custom profile version or every version of that user's profile,
   * including inactive/deprecated versions, and their templates so the same
   * identities can be created again. Built-in profiles cannot be removed (403)
   * and profiles from another user are indistinguishable from missing ones
   * (404) so their existence is never leaked.
   */
  public async removeCustomProfile(
    code: string,
    version: number | ReplicationProfileVersionSlot,
    options: RemoveCustomReplicationProfileOptions,
  ): Promise<ReplicationProfileWithTemplate> {
    const startedAt = new Date();
    const actor = this.actorFromMutationOptions(options);
    let profile: ReplicationProfile | null = null;

    try {
      const userId = this.requireOwnerUserId(options);
      const { removedProfile, template, profilesToRemove } = await replicationProfileTransaction(
        userId,
        async (manager, files) => {
          const repository = manager.getRepository(ReplicationProfile);
          const owned = await repository.find({
            where: this.ownedCustomProfileWhere({ code }, userId),
            order: { version: 'ASC' },
          });
          profile =
            owned.find((entry) =>
              typeof version === 'number'
                ? entry.version === version
                : entry.versionSlot === version,
            ) ?? null;
          if (!profile)
            throw await this.resolveMissingCustomProfileError(
              { code, ...this.versionWhere(version) },
              'Built-in profiles cannot be deleted.',
              repository,
            );
          const profilesToRemove = options.allVersions ? owned : [profile];
          const template = readReplicationProfileModel(profile);
          const removedProfile = { ...profile } as ReplicationProfile;
          await repository.remove(profilesToRemove);
          for (const removed of profilesToRemove) files.remove(removed);
          const previous = owned.find((entry) => entry.versionSlot === 'previous');
          if (!options.allVersions && removedProfile.versionSlot === 'latest' && previous) {
            const model = loadReplicationProfileModel(previous);
            const oldPath = { ...previous };
            previous.versionSlot = 'latest';
            // As in a rollback, the promoted version takes the current name.
            previous.name = removedProfile.name;
            previous.path = buildReplicationProfileTemplatePath(previous);
            await repository.save(previous);
            files.write(previous, model);
            files.remove(oldPath);
          }
          return { removedProfile, template, profilesToRemove };
        },
      );

      await this.auditProfileManagementSuccess({
        operation: 'remove',
        fwCloudId: options.fwCloudId,
        profile: removedProfile,
        actor,
        status: 200,
        startedAt,
        removal: {
          allVersions: options.allVersions === true,
          versions: profilesToRemove.map((removed) => removed.version),
        },
      });

      return { profile: removedProfile, template };
    } catch (error) {
      await this.auditProfileManagementFailure({
        operation: 'remove',
        fwCloudId: options.fwCloudId,
        actor,
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
   * owned by another user -- yields the generic 404 so their existence is
   * never leaked.
   */
  /** Inside a transaction, `repository` keeps the lookup on its connection. */
  private async resolveMissingCustomProfileError(
    builtInIdentity: FindOptionsWhere<ReplicationProfile>,
    builtInMessage: string,
    repository: Repository<ReplicationProfile> = this.repository,
  ): Promise<HttpException> {
    const builtInExists = await repository.exists({
      where: {
        ...builtInIdentity,
        userId: IsNull(),
        isBuiltin: true,
      },
    });

    return builtInExists
      ? new HttpException(builtInMessage, 403)
      : new NotFoundException('Replication profile not found');
  }

  /** Narrows a lookup to the custom profiles of one user, never a built-in or somebody else's. */
  private ownedCustomProfileWhere(
    where: FindOptionsWhere<ReplicationProfile>,
    userId: number,
  ): FindOptionsWhere<ReplicationProfile> {
    return { ...where, userId, isBuiltin: false };
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
      model: loadReplicationProfileModel(sourceProfile),
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
      fwCloudId: input.fwCloudId,
      data: this.cleanAuditData({
        operation: input.operation,
        result: 'success',
        ...this.profileAuditData(input.profile),
        fwCloudId: input.fwCloudId,
        ...this.sourceProfileAuditData(input.sourceProfile),
        ...this.previousProfileAuditData(input.previousProfile),
        ...this.removalAuditData(input.removal),
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
      case 'rollback':
        return PROFILE_ROLLBACK_AUDIT_CALL;
    }
  }

  private successAuditDescription(input: ReplicationProfileManagementSuccessAuditInput): string {
    if (input.operation === 'rollback')
      return `Custom replication profile ${input.profile.code} restored from previous.`;
    if (input.operation === 'create') {
      return `Custom replication profile ${input.profile.code} latest created.`;
    }

    if (input.operation === 'clone') {
      const source = input.sourceProfile;
      const sourceLabel = source
        ? `${source.code} (${source.versionSlot})`
        : 'selected replication profile';

      return `Replication profile ${sourceLabel} cloned as custom profile ${input.profile.code} latest.`;
    }

    if (input.operation === 'remove') {
      if (input.removal?.allVersions) {
        return `Custom replication profile ${input.profile.code} permanently removed (${input.removal.versions.length} versions).`;
      }

      return `Custom replication profile ${input.profile.code} ${input.profile.versionSlot} removed.`;
    }

    return `Custom replication profile ${input.profile.code} updated by rotating latest and previous.`;
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

  private removalAuditData(
    removal: ReplicationProfileManagementSuccessAuditInput['removal'],
  ): Record<string, unknown> {
    return removal
      ? {
          removed: true,
          allVersions: removal.allVersions,
          removedVersions: removal.versions,
          removedVersionCount: removal.versions.length,
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
        return `Failed to create custom replication profile ${profileLabel}: ${reason}.`;
      case 'clone':
        return `Failed to clone replication profile ${sourceLabel}: ${reason}.`;
      case 'update':
        return `Failed to update custom replication profile ${profileLabel}: ${reason}.`;
      case 'rollback':
        return `Failed to restore custom replication profile ${profileLabel}: ${reason}.`;
      case 'remove':
        return `Failed to remove custom replication profile ${profileLabel}: ${reason}.`;
    }
  }

  private profileAuditLabel(
    code?: string | null,
    version?: number | ReplicationProfileVersionSlot | null,
  ): string {
    if (!code) {
      return 'profile';
    }

    return version ? `${code} (${typeof version === 'number' ? 'latest' : version})` : code;
  }

  private actorFromMutationOptions(
    options: CreateCustomReplicationProfileOptions,
  ): ReplicationProfileMutationActor | undefined {
    if (options.actor) {
      return options.actor;
    }

    return options.userId !== undefined ? { userId: options.userId } : undefined;
  }

  /** Custom profiles belong to whoever manages them, so managing one requires that user. */
  private requireOwnerUserId(options: CreateCustomReplicationProfileOptions): number {
    const userId = options.actor?.userId ?? options.userId;

    if (!isReplicationProfileOwnerId(userId)) {
      throw new HttpException('A user is required to manage custom replication profiles.', 403);
    }

    return userId;
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

  /** Without a model (unreadable template) only the profile's own target kind counts. */
  public supportsTargetKind(
    profile: ReplicationProfile,
    targetKind: ReplicationProfileTargetKind,
    model: ReplicationProfileModel | null,
  ): boolean {
    return (
      normalizeReplicationProfileTargetKinds(profile.targetKind).includes(targetKind) ||
      getReplicationProfileModelTargetKinds(model).includes(targetKind)
    );
  }

  private filterCatalogProfiles(
    profiles: ReplicationProfile[],
    filters: ReplicationProfileCatalogFilters,
  ): ReplicationProfileWithTemplate[] {
    const search = filters.search?.trim().toLowerCase();

    const entries: ReplicationProfileWithTemplate[] = [];

    for (const profile of profiles) {
      if (search && !this.matchesCatalogSearch(profile, search)) {
        continue;
      }

      const template = readReplicationProfileModel(profile);
      if (
        !filters.targetKind ||
        this.supportsTargetKind(profile, filters.targetKind, template.model)
      ) {
        entries.push({ profile, template });
      }
    }

    return entries;
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

  private assertPayloadDefinitionIsValid(payload: ProfileDefinitionPayload): void {
    this.assertDefinitionIsValid(this.payloadDefinition(payload));
  }

  private payloadDefinition(payload: ProfileDefinitionPayload): ProfileDefinitionPayload {
    return {
      targetKind: payload.targetKind ?? DEFAULT_CUSTOM_PROFILE_TARGET_KIND,
      model: payload.model,
    };
  }

  /**
   * The payload as it is saved: the object references of its model captured from the FWCloud,
   * without which its definition is not valid.
   */
  private async captureObjectReferences<T extends ProfileDefinitionPayload>(
    payload: T,
    fwCloudId: number,
  ): Promise<T> {
    return { ...payload, model: await captureProfileObjectReferences(payload.model, fwCloudId) };
  }

  /**
   * `freeCode` and `freeName` mark values derived by the API:
   * when taken, its first free variant is used, since a renamed template
   * keeps the code of its former name.
   */
  private persistCustomProfile(
    payload: CreateCustomReplicationProfileVersionPayload,
    options: CreateCustomReplicationProfileOptions,
    identity: CustomReplicationProfileIdentity,
    persistence: CustomReplicationProfilePersistenceOptions = {},
  ): Promise<ReplicationProfile> {
    const { userId } = identity;
    const now = new Date();

    return replicationProfileTransaction(userId, async (manager, files) => {
      const repository = manager.getRepository(ReplicationProfile);
      const owned = await repository.find({ where: this.ownedCustomProfileWhere({}, userId) });
      let code = identity.code;
      let name = payload.name;
      if (persistence.rejectExisting) {
        const codeKey = code.toLowerCase();
        const nameKey = replicationProfileNameKey(name);
        const conflicts = owned.filter(
          (profile) =>
            profile.code.toLowerCase() === codeKey ||
            (profile.versionSlot === 'latest' &&
              replicationProfileNameKey(profile.name) === nameKey),
        );
        if (conflicts.length) throw new ReplicationProfileImportConflictException(conflicts);
      } else {
        const codes = new Set(
          owned
            .filter((profile) => profile.isActive && !profile.isDeprecated)
            .map((profile) => profile.code.toLowerCase()),
        );
        if (persistence.freeCode)
          code = firstFreeReplicationProfileValue(code, '-', (candidate) =>
            codes.has(candidate.toLowerCase()),
          );
        const codeKey = code.toLowerCase();
        if (codes.has(codeKey)) {
          throw new HttpException(
            `Replication profile "${code}" already exists for this user.`,
            409,
          );
        }
        const names = this.currentNameKeys(owned);
        if (persistence.freeName)
          name = firstFreeReplicationProfileValue(name, ' ', (candidate) =>
            names.has(replicationProfileNameKey(candidate)),
          );
        if (names.has(replicationProfileNameKey(name)))
          throw replicationProfileNameTakenException();
        // Creation and cloning replace inactive/deprecated rows; import never replaces them.
        const existing = owned.filter((profile) => profile.code.toLowerCase() === codeKey);
        for (const old of existing) files.remove(old);
        if (existing.length) await repository.remove(existing);
      }
      const savedProfile = await repository.save(
        repository.create({
          ...this.profileMetadata(payload, name),
          code,
          version: identity.version,
          versionSlot: 'latest',
          path: buildReplicationProfileTemplatePath({ ...identity, code }),
          isBuiltin: false,
          isActive: true,
          isDeprecated: false,
          fwCloudId: options.fwCloudId,
          userId,
          created_by: userId,
          updated_by: userId,
          created_at: now,
          updated_at: now,
        }),
      );
      if (persistence.rejectExisting) files.create(savedProfile, payload.model);
      else files.write(savedProfile, payload.model);
      if (persistence.previous) {
        const previous = repository.create({
          ...savedProfile,
          ...this.profileMetadata(persistence.previous),
          id: undefined,
          version: 1,
          versionSlot: 'previous',
          path: buildReplicationProfileTemplatePath({ ...identity, code, versionSlot: 'previous' }),
        });
        files.create(previous, persistence.previous.model);
        await repository.save(previous);
      }
      return savedProfile;
    });
  }

  /** Metadata shared by creation, import and version rotation. Identity and audit fields stay separate. */
  private profileMetadata(
    payload: Omit<CreateCustomReplicationProfileVersionPayload, 'model'>,
    name = payload.name,
  ): Pick<ReplicationProfile, 'name' | 'description' | 'scope' | 'targetKind' | 'category'> {
    return {
      name,
      description: payload.description ?? null,
      scope: payload.scope,
      targetKind: this.effectiveProfileTargetKind(payload.targetKind),
      category: payload.category ?? null,
    };
  }

  /** Name keys of the current templates of an owner, except those of `exceptCode`. */
  private currentNameKeys(owned: ReplicationProfile[], exceptCode?: string): Set<string> {
    const exceptCodeKey = exceptCode?.toLowerCase();
    return new Set(
      owned
        .filter(
          (profile) =>
            profile.versionSlot === 'latest' &&
            profile.isActive &&
            !profile.isDeprecated &&
            profile.code.toLowerCase() !== exceptCodeKey,
        )
        .map((profile) => replicationProfileNameKey(profile.name)),
    );
  }

  private effectiveProfileTargetKind(targetKind: string | undefined): ReplicationProfileTargetKind {
    return isReplicationProfileStringValue(targetKind, REPLICATION_PROFILE_TARGET_KINDS)
      ? targetKind
      : DEFAULT_CUSTOM_PROFILE_TARGET_KIND;
  }
}
