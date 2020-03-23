import { Entity, PrimaryGeneratedColumn, Column, ManyToMany, ManyToOne, JoinTable, JoinColumn, OneToMany } from "typeorm";
import Model from "../Model";
import { Firewall } from "../firewall/Firewall";
import { RoutingGroup } from "./routing-group.model";
import { RoutingRuleToIPObj } from "./routing-rule-to-ipobj.model";

const tableName: string = 'routing_r';

@Entity(tableName)
export class RoutingRule extends Model {
    
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    idgroup: number;

    @Column()
    rule_order: number;

    @Column()
    metric: number;

    @Column()
    options: string;

    @Column()
    comment: string;

    @Column()
    active: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @ManyToOne(type => RoutingGroup, routingGroup => routingGroup.routingRules)
    @JoinColumn({
        name: 'idgroup'
    })
    routingGroup: Array<RoutingGroup>;

    @OneToMany(type => RoutingRuleToIPObj, routingRuleToIPObj => routingRuleToIPObj.routingRule)
    routingRuleToIPObjs!: Array<RoutingRuleToIPObj>;

    @ManyToOne(type => Firewall, firewall => firewall.routingRules)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    public getTableName(): string {
        return tableName;
    }

}