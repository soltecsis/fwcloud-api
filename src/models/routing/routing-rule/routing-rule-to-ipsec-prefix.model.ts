import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { RoutingRule } from './routing-rule.model';
import { IPSecPrefix } from '../../vpn/ipsec/IPSecPrefix';

const tableName: string = 'routing_r__ipsec_prefix';

@Entity(tableName)
export class RoutingRuleToIPSecPrefix extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'ipsec_prefix',
  })
  ipsecPrefixId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToIPSecPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => IPSecPrefix, (model) => model.routingRuleToIPSecPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipsec_prefix',
  })
  ipsecPrefix: IPSecPrefix;

  public getTableName(): string {
    return tableName;
  }
}
