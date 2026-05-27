import db from '../../database/database-manager';
import { Service } from '../../fonaments/services/service';
import { ReplicationProfile } from './replication-profile.model';

export class ReplicationProfileService extends Service {
  public async build(): Promise<ReplicationProfileService> {
    await super.build();
    return this;
  }

  public async findActive(): Promise<ReplicationProfile[]> {
    return db
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
}
