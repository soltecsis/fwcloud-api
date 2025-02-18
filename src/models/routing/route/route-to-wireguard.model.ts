import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { WireGuard } from '../../vpn/wireguard/WireGuard';
import { Route } from './route.model';

const tableName: string = 'route__wireguard';

@Entity(tableName)
export class RouteToWireGuard extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'wireguard',
  })
  openVPNId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToWireGuards, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => WireGuard, (model) => model.routeToWireGuards, {
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
