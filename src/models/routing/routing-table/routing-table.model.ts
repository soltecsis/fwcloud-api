import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import Model from "../../Model";
import { Route } from "../route/route.model";
const tableName: string = 'routing_table';

@Entity(tableName)
export class RoutingTable extends Model {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({name: 'firewall'})
    firewallId: number;

    @ManyToOne(type => Firewall, firewall => firewall.routingTables)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @Column()
    number: number;

    @Column()
    name: string;

    @Column()
    comment?: string;

    @OneToMany(type => Route, model => model.routingTable)
	routes: Route[];
    
    public getTableName(): string {
        return tableName;
    }

}