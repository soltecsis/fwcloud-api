import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IPObj } from '../../ipobj/IPObj';
import Model from '../../Model';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__ipobj';

@Entity(tableName)
export class RoutingRuleToIPObj extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'ipobj',
  })
  ipObjId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToIPObjs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => IPObj, (model) => model.routingRuleToIPObjs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipobj',
  })
  ipObj: IPObj;

  public getTableName(): string {
    return tableName;
  }
}
