import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import {
  isReplicationProfileTargetKind,
  ReplicationProfile,
  ReplicationProfileTargetKind,
} from './replication-profile.model';

export class ReplicationProfileService extends Service {
  public async build(): Promise<ReplicationProfileService> {
    await super.build();
    return this;
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
    const compatibleTargetKinds = new Set<ReplicationProfileTargetKind>();
    const profileTargetKind = this.normalizeTargetKind(profile.targetKind);

    if (profileTargetKind) {
      compatibleTargetKinds.add(profileTargetKind);
    }

    for (const candidate of this.getModelCompatibilityTargetKinds(profile.model)) {
      compatibleTargetKinds.add(candidate);
    }

    return compatibleTargetKinds.has(targetKind);
  }

  private getModelCompatibilityTargetKinds(
    model: Record<string, unknown> | null | undefined,
  ): ReplicationProfileTargetKind[] {
    if (!model || typeof model !== 'object' || Array.isArray(model)) {
      return [];
    }

    const compatibility = this.asRecord(model.compatibility);
    const candidates: unknown[] = [
      model.targetKind,
      model.target_kind,
      compatibility?.targetKinds,
      compatibility?.target_kinds,
      compatibility?.targetKind,
      compatibility?.target_kind,
    ];

    return candidates.flatMap((candidate) => this.normalizeTargetKinds(candidate));
  }

  private normalizeTargetKinds(value: unknown): ReplicationProfileTargetKind[] {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.normalizeTargetKind(item))
        .filter((item): item is ReplicationProfileTargetKind => item !== null);
    }

    const targetKind = this.normalizeTargetKind(value);

    return targetKind ? [targetKind] : [];
  }

  private normalizeTargetKind(value: unknown): ReplicationProfileTargetKind | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();

    return isReplicationProfileTargetKind(normalized) ? normalized : null;
  }

  private asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }
}
