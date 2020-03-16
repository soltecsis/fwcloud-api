import Model from "../Model";
import { IPObjType } from "../ipobj/IPObjType";
import { Entity, PrimaryColumn, ManyToMany } from "typeorm";

const tableName: string = 'routing_position';

@Entity(tableName)
export class RoutingPosition extends Model {
    
    @PrimaryColumn()
    id: number;

    public getTableName(): string {
        return tableName;
    }

}