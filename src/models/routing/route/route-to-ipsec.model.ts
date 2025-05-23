import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { IPSec } from '../../vpn/ipsec/IPSec';
import { Route } from './route.model';

const tableName: string = 'route__ipsec';

@Entity(tableName)
export class RouteToIPSec extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'ipsec',
  })
  openVPNId: number; // TODO: REVISAR, ES OPENVPN O IPSEC? REVISAR TAMBIEN EN WIREGUARD

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToIPSecs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => IPSec, (model) => model.routeToIPSecs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipsec',
  })
  ipSec: IPSec;

  public getTableName(): string {
    return tableName;
  }
}
