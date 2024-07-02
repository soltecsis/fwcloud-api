import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IPObjGroup } from '../../ipobj/IPObjGroup';
import Model from '../../Model';
import { Route } from './route.model';

const tableName: string = 'route__ipobj_g';

@Entity(tableName)
export class RouteToIPObjGroup extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'ipobj_g',
  })
  ipObjGroupId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToIPObjGroups, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => IPObjGroup, (model) => model.routeToIPObjGroups, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipobj_g',
  })
  ipObjGroup: IPObjGroup;

  public getTableName(): string {
    return tableName;
  }
}
