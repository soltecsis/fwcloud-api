import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { Interface } from "../../interface/Interface";
import { IPObj } from "../../ipobj/IPObj";
import Model from "../../Model";
import { RoutingTable } from "../routing-table/routing-table.model";

const tableName: string = 'route';

@Entity(tableName)

export class Route extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column({
        type: Number,
        name: 'group'
    })
    groupId: number;

    @Column({name: 'routing_table'})
    routingTableId: number;

    @ManyToOne(type => RoutingTable, model => model.routes)
    @JoinColumn({
        name: 'routing_table'
    })
    routingTable: RoutingTable;

    
    @Column({name: 'gateway'})
    gatewayId: number;

    @ManyToOne(type => IPObj, model => model.routes)
    @JoinColumn({
        name: 'gateway'
    })
    gateway: IPObj;



    @Column({name: 'interface'})
    interfaceId: number;

    @ManyToOne(type => Interface, model => model.routes)
    @JoinColumn({
        name: 'interface'
    })
    interface: Interface;

    @Column({
        type: Boolean,
    })
    active: boolean;

    @Column()
    comment: string;

    public getTableName(): string {
        return tableName;
    }

}