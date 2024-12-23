import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { WireGuard } from '../../vpn/wireguard/WireGuard';
import { Route } from './route.model';

const tableName: string = 'route__wireGuard';

@Entity(tableName)
export class RouteToWireGuard extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'wireGuard',
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
    name: 'wireGuard',
  })
  wireGuard: WireGuard;

  public getTableName(): string {
    return tableName;
  }
}
