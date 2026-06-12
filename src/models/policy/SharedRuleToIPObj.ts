import Model from '../Model';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Interface } from '../interface/Interface';
import { IPObj } from '../ipobj/IPObj';
import { IPObjGroup } from '../ipobj/IPObjGroup';
import { PolicyPosition } from './PolicyPosition';
import { SharedRule } from './SharedRule';

const tableName: string = 'shared_rule__ipobj';

@Entity(tableName)
export class SharedRuleToIPObj extends Model {
  @PrimaryGeneratedColumn({ name: 'id_pi' })
  id: number;

  @Column({ name: 'rule' })
  sharedRuleId: number;

  @Column({ name: 'ipobj' })
  ipObjId: number;

  @Column({ name: 'ipobj_g' })
  ipObjGroupId: number;

  @Column({ name: 'interface' })
  interfaceId: number;

  @Column({ name: 'position' })
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

  @ManyToOne(() => SharedRule, (sharedRule) => sharedRule.sharedRuleToIPObjs)
  @JoinColumn({ name: 'rule' })
  sharedRule: SharedRule;

  @ManyToOne(() => IPObj)
  @JoinColumn({ name: 'ipobj' })
  ipObj: IPObj;

  @ManyToOne(() => IPObjGroup)
  @JoinColumn({ name: 'ipobj_g' })
  ipObjGroup: IPObjGroup;

  @ManyToOne(() => Interface)
  @JoinColumn({ name: 'interface' })
  interface: Interface;

  @ManyToOne(() => PolicyPosition)
  @JoinColumn({ name: 'position' })
  policyPosition: PolicyPosition;

  public getTableName(): string {
    return tableName;
  }
}
