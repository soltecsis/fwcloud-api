import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { IPObj } from '../../ipobj/IPObj';
import Model from '../../Model';
import { Route } from './route.model';

const tableName: string = 'route__ipobj';

@Entity(tableName)
export class RouteToIPObj extends Model {
  @PrimaryColumn({
    name: 'route',
  })
  routeId: number;

  @PrimaryColumn({
    name: 'ipobj',
  })
  ipObjId: number;

  @Column({
    type: Number,
  })
  order: number;

  @ManyToOne(() => Route, (model) => model.routeToIPObjs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'route',
  })
  route: Route;

  @ManyToOne(() => IPObj, (model) => model.routeToIPObjs, {
    orphanedRowAction: 'delete',
  })
  @JoinColumn({
    name: 'ipobj',
  })
  ipObj: IPObj;

  public getTableName(): string {
    return tableName;
  }
}
