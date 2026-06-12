import Model from '../Model';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Interface } from '../interface/Interface';
import { PolicyPosition } from './PolicyPosition';
import { SharedRule } from './SharedRule';

const tableName: string = 'shared_rule__interface';

@Entity(tableName)
export class SharedRuleToInterface extends Model {
  @PrimaryColumn({ name: 'rule' })
  sharedRuleId: number;

  @PrimaryColumn({ name: 'interface' })
  interfaceId: number;

  @PrimaryColumn({ name: 'position' })
  policyPositionId: number;

  @Column()
  position_order: number;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @ManyToOne(() => SharedRule, (sharedRule) => sharedRule.sharedRuleToInterfaces)
  @JoinColumn({ name: 'rule' })
  sharedRule: SharedRule;

  @ManyToOne(() => Interface)
  @JoinColumn({ name: 'interface' })
  sharedRuleInterface: Interface;

  @ManyToOne(() => PolicyPosition)
  @JoinColumn({ name: 'position' })
  policyPosition: PolicyPosition;

  public getTableName(): string {
    return tableName;
  }
}
