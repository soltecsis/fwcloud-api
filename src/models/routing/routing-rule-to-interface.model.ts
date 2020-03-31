import Model from "../Model";
import { PrimaryColumn, Column, ManyToOne, JoinColumn, Entity } from "typeorm";
import { Interface } from "../interface/Interface";
import { RoutingRule } from "./routing-rule.model";

const tableName: string = 'routing_r__interface';

@Entity(tableName)
export class RoutingRuleToInterface extends Model {

    @PrimaryColumn({name: 'rule'})
    routingRuleId: number;

    @PrimaryColumn({name: 'interface'})
    interfaceId: number;

    @Column()
    interface_order: string;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    
    @ManyToOne(type => Interface, _interface => _interface.routingRuleToInterfaces)
    @JoinColumn({
        name: 'interface'
    })
    routingRuleInterface: Interface;

    @ManyToOne(type => RoutingRule, policyRule => policyRule.routingRuleToInterfaces)
    @JoinColumn({
        name: 'rule'
    })
    routingRule: RoutingRule;


    public getTableName(): string {
        return tableName;
    }

}