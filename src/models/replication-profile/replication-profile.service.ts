import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { FindOptionsWhere, IsNull, Repository } from 'typeorm';
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

    if (!targetKind) {
      return profiles;
    }

    return profiles.filter((profile) => this.supportsTargetKind(profile, targetKind));
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
