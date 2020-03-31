import Model from "../Model";
import { Firewall } from "../firewall/Firewall";
import { ManyToOne, JoinColumn, PrimaryGeneratedColumn, Column, OneToMany, Entity } from "typeorm";
import { RoutingRule } from "./routing-rule.model";

const tableName: string = 'routing_g';

@Entity(tableName)
export class RoutingGroup extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    name: string;

    @Column()
    comment: string;

    @Column({name: 'idgroup'})
    parentId: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @Column({name: 'firewall'})
    firewallId: number;
    
    @ManyToOne(type => Firewall, firewall => firewall.routingRules)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @ManyToOne(type => RoutingGroup, model => model.childs)
    @JoinColumn({
        name: 'idgroup'
    })
    parent: RoutingGroup;

    @OneToMany(type => RoutingGroup, model => model.parent)
    childs: Array<RoutingGroup>;

    @OneToMany(type => RoutingRule, routingRule => routingRule.routingGroup)
    routingRules: Array<RoutingRule>;

    public getTableName(): string {
        return tableName;
    }

}