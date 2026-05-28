import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import Model from '../Model';

const tableName = 'replication_profiles';

export const REPLICATION_PROFILE_TARGET_KINDS = ['firewall', 'cluster'] as const;
export type ReplicationProfileTargetKind = (typeof REPLICATION_PROFILE_TARGET_KINDS)[number];

export function isReplicationProfileTargetKind(
  value: string,
): value is ReplicationProfileTargetKind {
  return (REPLICATION_PROFILE_TARGET_KINDS as readonly string[]).includes(value);
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

  @Column({
    type: 'simple-json',
  })
  model: Record<string, unknown>;

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

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  public getTableName(): string {
    return tableName;
  }
}
