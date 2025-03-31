import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { WireGuard } from '../../vpn/wireguard/WireGuard';
import { RoutingRule } from './routing-rule.model';

const tableName: string = 'routing_r__wireguard';

@Entity(tableName)
export class RoutingRuleToWireGuard extends Model {
  @PrimaryColumn({
    name: 'rule',
  })
  routingRuleId: number;

  @PrimaryColumn({
    name: 'wireguard',
  })
  wireGuardId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => RoutingRule, (model) => model.routingRuleToWireGuards, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'rule',
  })
  routingRule: RoutingRule;

  @ManyToOne(() => WireGuard, (model) => model.routingRuleToWireGuards, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'wireguard',
  })
  wireGuard: WireGuard;

  public getTableName(): string {
    return tableName;
  }
}
