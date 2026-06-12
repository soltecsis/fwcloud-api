import Model from '../Model';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { FwCloud } from '../fwcloud/FwCloud';
import { PolicyType } from './PolicyType';
import { SharedRule } from './SharedRule';
import { PolicyRuleToSharedRuleSet } from './PolicyRuleToSharedRuleSet';

const tableName: string = 'shared_rule_set';

@Entity(tableName)
export class SharedRuleSet extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'fwcloud' })
  fwCloudId: number;

  @ManyToOne(() => FwCloud)
  @JoinColumn({ name: 'fwcloud' })
  fwCloud: FwCloud;

  @Column()
  name: string;

  @Column({ name: 'policy_type' })
  policyTypeId: number;

  @ManyToOne(() => PolicyType)
  @JoinColumn({ name: 'policy_type' })
  policyType: PolicyType;

  @Column()
  comment: string;

  @Column()
  style: string;

  @Column()
  active: number;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @OneToMany(() => SharedRule, (sharedRule) => sharedRule.sharedRuleSet)
  rules: SharedRule[];

  @OneToMany(() => PolicyRuleToSharedRuleSet, (application) => application.sharedRuleSet)
  policyApplications: PolicyRuleToSharedRuleSet[];

  public getTableName(): string {
    return tableName;
  }
}
