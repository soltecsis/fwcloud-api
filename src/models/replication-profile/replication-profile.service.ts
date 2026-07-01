import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { ReplicationProfile } from './replication-profile.model';
import {
  getReplicationProfileModelTargetKinds,
  normalizeReplicationProfileTargetKinds,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';
import {
  ReplicationProfileValidationError,
  ReplicationProfileValidationService,
} from './replication-profile-validation.service';

export class ReplicationProfileService extends Service {
  protected _validationService: ReplicationProfileValidationService;

  public async build(): Promise<ReplicationProfileService> {
    await super.build();
    this._validationService = await this._app.getService<ReplicationProfileValidationService>(
      ReplicationProfileValidationService.name,
    );

    return this;
  }

  public validateDefinition(payload: unknown): ReplicationProfileValidationError[] {
    return this._validationService.validate(payload);
  }

  public assertDefinitionIsValid(payload: unknown): void {
    this._validationService.assertValid(payload);
  }

  public async findActive(
    targetKind?: ReplicationProfileTargetKind,
  ): Promise<ReplicationProfile[]> {
    const profiles = await db
      .getSource()
      .manager.getRepository(ReplicationProfile)
      .find({
        where: {
          isActive: true,
          isDeprecated: false,
        },
        order: {
          code: 'ASC',
          version: 'DESC',
        },
      });

    if (!targetKind) {
      return profiles;
    }

    return profiles.filter((profile) => this.supportsTargetKind(profile, targetKind));
  }

  public async findByCodeAndVersion(
    code: string,
    version: number,
  ): Promise<ReplicationProfile | null> {
    return db
      .getSource()
      .manager.getRepository(ReplicationProfile)
      .findOne({
        where: {
          code,
          version,
          isActive: true,
          isDeprecated: false,
        },
      });
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
}
