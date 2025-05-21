import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import Model from '../../Model';
import { IPSecPrefix } from '../../vpn/ipsec/IPSecPrefix';
import { Route } from './route.model';

const tableName: string = 'route__ipsec_prefix';

@Entity(tableName)
export class RouteToIPSecPrefix extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'ipsec_prefix',
  })
  ipsecPrefixId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToIPSecPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => IPSecPrefix, (model) => model.routeToIPSecPrefixes, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipsec_prefix',
  })
  ipsecPrefix: IPSecPrefix;

  public getTableName(): string {
    return tableName;
  }
}
