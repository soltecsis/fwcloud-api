import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { RoutingRule } from './routing-rule.model';
import { WireGuardPrefix } from '../../vpn/wireguard/WireGuardPrefix';

const tableName: string = 'routing_r__openvpn_prefix';

@Entity(tableName)
export class RoutingRuleToWireGuardPrefix extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'openvpn_prefix',
  })
  openVPNPrefixId: number;

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
    name: 'openvpn_prefix',
  })
  openVPNPrefix: WireGuardPrefix;
  wireGuardPrefix: any;

  public getTableName(): string {
    return tableName;
  }
}
