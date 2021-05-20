import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { Firewall } from "../../firewall/Firewall";
import Model from "../../Model";
import { Route } from "../route/route.model";
import { RoutingRule } from "../routing-rule/routing-rule.model";
const tableName: string = 'routing_table';

@Entity(tableName)
export class RoutingTable extends Model {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    number: number;

    @Column()
    name: string;

    @Column()
    comment?: string;

    @Column({name: 'firewall'})
    firewallId: number;

    @ManyToOne(type => Firewall, firewall => firewall.routingTables)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @OneToMany(type => Route, model => model.routingTable)
	routes: Route[];

    @OneToMany(type => RoutingRule, model => model.routingTable)
	routingRules: RoutingRule[];
    
    public getTableName(): string {
        return tableName;
    }

}