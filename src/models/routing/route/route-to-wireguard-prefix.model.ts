import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { WireGuardPrefix } from '../../vpn/wireguard/WireGuardPrefix';
import { Route } from './route.model';

const tableName: string = 'route__wireguard_prefix';

@Entity(tableName)
export class RouteToWireGuardPrefix extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'wireguard_prefix',
  })
  wireGuardPrefixId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToWireGuardPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => WireGuardPrefix, (model) => model.routeToWireGuardPrefixes, {
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
