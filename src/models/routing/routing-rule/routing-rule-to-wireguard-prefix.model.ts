import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { RoutingRule } from './routing-rule.model';
import { WireGuardPrefix } from '../../vpn/wireguard/WireGuardPrefix';

const tableName: string = 'routing_r__wireguard_prefix';

@Entity(tableName)
export class RoutingRuleToWireGuardPrefix extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'wireguard_prefix',
  })
  wireGuardPrefixId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToWireGuardPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => WireGuardPrefix, (model) => model.routingRuleToWireGuardPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'wireguard_prefix',
  })
  wireGuardPrefix: WireGuardPrefix;

  public getTableName(): string {
    return tableName;
  }
}
