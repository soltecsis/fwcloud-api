import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { OpenVPN } from '../../vpn/openvpn/OpenVPN';
import { Route } from './route.model';

const tableName: string = 'route__openvpn';

@Entity(tableName)
export class RouteToOpenVPN extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'openvpn',
  })
  openVPNId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToOpenVPNs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => OpenVPN, (model) => model.routeToOpenVPNs, {
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
