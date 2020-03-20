import Model from "../Model";
import { PrimaryColumn, OneToMany, JoinTable, ManyToOne, Column, JoinColumn, Entity } from "typeorm";
import { IPObjType } from "./IPObjType";
import { RoutingPosition } from "../routing/routing-position.model";

const tableName: string = 'ipobj_type__routing_position';

@Entity(tableName)
export class IPObjTypeToRoutingPosition extends Model {
    @PrimaryColumn()
    type: number;

    @PrimaryColumn()
    position: number;


    @ManyToOne(type => IPObjType, ipObjType => ipObjType.routingPositions)
    @JoinColumn({
        name: 'type'
    })
    ipObjType: IPObjType;

    @ManyToOne(type => RoutingPosition, routingPosition => routingPosition.ipObjTypes)
    @JoinColumn({
        name: 'position'
    })
    routingPosition: RoutingPosition;

    @Column()
    allowed: number;
    
    public getTableName(): string {
        return tableName;
    }

}