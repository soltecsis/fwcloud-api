import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { OpenVPNPrefix } from '../../vpn/openvpn/OpenVPNPrefix';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__openvpn_prefix';

@Entity(tableName)
export class RoutingRuleToOpenVPNPrefix extends Model {
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

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToOpenVPNPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(
    () => OpenVPNPrefix,
    (model) => model.routingRuleToOpenVPNPrefixes,
    {
      orphanedRowAction: 'delete',
    },
  )
  @JoinColumn({
    name: 'openvpn_prefix',
  })
  openVPNPrefix: OpenVPNPrefix;

  public getTableName(): string {
    return tableName;
  }
}
