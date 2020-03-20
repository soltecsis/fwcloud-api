import Model from "../Model";
import { IPObjType } from "../ipobj/IPObjType";
import { Entity, PrimaryColumn, ManyToMany, OneToMany, JoinColumn } from "typeorm";
import { IPObjTypeToRoutingPosition } from "../ipobj/ipobj_type-to-routing_position.model";

const tableName: string = 'routing_position';

@Entity(tableName)
export class RoutingPosition extends Model {
    
    @PrimaryColumn()
    id: number;

    @OneToMany(type => IPObjTypeToRoutingPosition, ipObjTypeToRoutingPosition => ipObjTypeToRoutingPosition.routingPosition)
    ipObjTypes: Array<IPObjType>;

    public getTableName(): string {
        return tableName;
    }

}