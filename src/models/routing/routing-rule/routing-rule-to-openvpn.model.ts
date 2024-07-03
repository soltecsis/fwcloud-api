import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { OpenVPN } from '../../vpn/openvpn/OpenVPN';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__openvpn';

@Entity(tableName)
export class RoutingRuleToOpenVPN extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'openvpn',
  })
  openVPNId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToOpenVPNs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => OpenVPN, (model) => model.routingRuleToOpenVPNs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'openvpn',
  })
  openVPN: OpenVPN;

  public getTableName(): string {
    return tableName;
  }
}
