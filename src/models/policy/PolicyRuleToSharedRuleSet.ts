import Model from '../Model';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Firewall } from '../firewall/Firewall';
import { PolicyType } from './PolicyType';
import { SharedRuleSet } from './SharedRuleSet';

const tableName: string = 'policy_r__shared_rule_set';

@Entity(tableName)
export class PolicyRuleToSharedRuleSet extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'firewall' })
  firewallId: number;

  @ManyToOne(() => Firewall)
  @JoinColumn({ name: 'firewall' })
  firewall: Firewall;

  @Column({ name: 'type' })
  policyTypeId: number;

  @ManyToOne(() => PolicyType)
  @JoinColumn({ name: 'type' })
  policyType: PolicyType;

  @Column({ name: 'shared_rule_set' })
  sharedRuleSetId: number;

  @ManyToOne(() => SharedRuleSet, (sharedRuleSet) => sharedRuleSet.policyApplications)
  @JoinColumn({ name: 'shared_rule_set' })
  sharedRuleSet: SharedRuleSet;

  @Column()
  rule_order: number;

  @Column()
  active: number;

  @Column()
  style: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  public getTableName(): string {
    return tableName;
  }
}
