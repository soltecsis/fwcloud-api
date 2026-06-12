import Model from '../Model';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Firewall } from '../firewall/Firewall';
import { Mark } from '../ipobj/Mark';
import { PolicyType } from './PolicyType';
import { SharedRuleSet } from './SharedRuleSet';
import { SharedRuleToInterface } from './SharedRuleToInterface';
import { SharedRuleToIPObj } from './SharedRuleToIPObj';

const tableName: string = 'shared_rule';

@Entity(tableName)
export class SharedRule extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shared_rule_set' })
  sharedRuleSetId: number;

  @ManyToOne(() => SharedRuleSet, (sharedRuleSet) => sharedRuleSet.rules)
  @JoinColumn({ name: 'shared_rule_set' })
  sharedRuleSet: SharedRuleSet;

  @Column()
  rule_order: number;

  @Column()
  direction: number;

  @Column()
  action: number;

  @Column()
  time_start: Date;

  @Column()
  time_end: Date;

  @Column()
  comment: string;

  @Column()
  options: number;

  @Column()
  active: number;

  @Column({ name: 'type' })
  policyTypeId: number;

  @ManyToOne(() => PolicyType)
  @JoinColumn({ name: 'type' })
  policyType: PolicyType;

  @Column()
  style: string;

  @Column({ name: 'fw_apply_to' })
  firewallApplyToId: number;

  @ManyToOne(() => Firewall)
  @JoinColumn({ name: 'fw_apply_to' })
  firewallApplyTo: Firewall;

  @Column()
  negate: string;

  @Column({ name: 'mark' })
  markId: number;

  @ManyToOne(() => Mark)
  @JoinColumn({ name: 'mark' })
  mark: Mark;

  @Column()
  special: number;

  @Column()
  run_before: string;

  @Column()
  run_after: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @OneToMany(
    () => SharedRuleToInterface,
    (sharedRuleToInterface) => sharedRuleToInterface.sharedRule,
  )
  sharedRuleToInterfaces: SharedRuleToInterface[];

  @OneToMany(() => SharedRuleToIPObj, (sharedRuleToIPObj) => sharedRuleToIPObj.sharedRule)
  sharedRuleToIPObjs: SharedRuleToIPObj[];

  public getTableName(): string {
    return tableName;
  }
}
