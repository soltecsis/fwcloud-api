import { BeforeInsert, BeforeUpdate, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../Model';
import { resolveReplicationProfileTemplatePath } from './replication-profile-template';
import {
  isReplicationProfileStringValue,
  REPLICATION_PROFILE_TARGET_KINDS,
} from './replication-profile.constants';
import type { ReplicationProfileTargetKind } from './replication-profile.constants';

const tableName = 'replication_profiles';

export {
  REPLICATION_PROFILE_INTERFACE_ROLE_FIELDS,
  REPLICATION_PROFILE_INTERFACE_ROLES,
  REPLICATION_PROFILE_RULE_ACTIONS,
  REPLICATION_PROFILE_RULE_PROTOCOLS,
  REPLICATION_PROFILE_TARGET_KINDS,
  asReplicationProfileNonEmptyString,
  asReplicationProfileRecord,
  isReplicationProfilePort,
  isReplicationProfileStringValue,
} from './replication-profile.constants';
export type { ReplicationProfileTargetKind } from './replication-profile.constants';

export function isReplicationProfileTargetKind(
  value: string,
): value is ReplicationProfileTargetKind {
  return isReplicationProfileStringValue(value, REPLICATION_PROFILE_TARGET_KINDS);
}

@Entity(tableName)
export class ReplicationProfile extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  code: string;

  @Column()
  version: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string | null;

  @Column()
  scope: string;

  @Column({
    name: 'target_kind',
  })
  targetKind: ReplicationProfileTargetKind;

  /**
   * Template holding the profile model, relative to `config/templates`. Load
   * and store the model through replication-profile-template.ts.
   */
  @Column()
  path: string;

  @Column({
    name: 'is_built_in',
    type: Boolean,
  })
  isBuiltin: boolean;

  @Column({
    name: 'is_active',
    type: Boolean,
  })
  isActive: boolean;

  @Column({
    name: 'is_deprecated',
    type: Boolean,
  })
  isDeprecated: boolean;

  /**
   * FWCloud that owns this custom profile. NULL for built-in/global profiles,
   * which are shared by every FWCloud. The DB-only generated column
   * `fwcloud_ns` (COALESCE(fwcloud_id, 0)) is intentionally not mapped here.
   */
  @Column({ name: 'fwcloud_id', nullable: true })
  fwCloudId: number | null;

  @Column({ nullable: true })
  category: string | null;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column({ nullable: true })
  created_by: number | null;

  @Column({ nullable: true })
  updated_by: number | null;

  /**
   * Keep the entity as the final persistence boundary for template paths, so
   * no save can point a profile at a file outside the templates directory.
   * The model itself is validated when its template is written and read.
   */
  @BeforeInsert()
  @BeforeUpdate()
  rejectUnsafeTemplatePath(): void {
    resolveReplicationProfileTemplatePath(this);
  }

  public getTableName(): string {
    return tableName;
  }
}
