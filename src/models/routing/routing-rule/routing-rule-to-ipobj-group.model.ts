import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import Model from '../../Model';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__ipobj_g';

@Entity(tableName)
export class RoutingRuleToIPObjGroup extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'ipobj_g',
  })
  ipObjGroupId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToIPObjGroups, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => IPObjGroup, (model) => model.routingRuleToIPObjGroups, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipobj_g',
  })
  ipObjGroup: IPObjGroup;

  public getTableName(): string {
    return tableName;
  }
}
