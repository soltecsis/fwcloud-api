import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { IPSec } from '../../vpn/ipsec/IPSec';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__ipsec';

@Entity(tableName)
export class RoutingRuleToIPSec extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'ipsec',
  })
  ipsecId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToIPSecs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => IPSec, (model) => model.routingRuleToIPSecs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipsec',
  })
  ipsec: IPSec;

  public getTableName(): string {
    return tableName;
  }
}
