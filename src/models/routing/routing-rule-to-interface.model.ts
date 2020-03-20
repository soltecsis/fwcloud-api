import Model from "../Model";
import { PrimaryColumn, Column, ManyToOne, JoinColumn, Entity } from "typeorm";
import { PolicyRule } from "../policy/PolicyRule";
import { Interface } from "../interface/Interface";

const tableName: string = 'routing_r__interface';

@Entity(tableName)
export class RoutingRuleToInterface extends Model {

    @PrimaryColumn()
    rule: number;

    @PrimaryColumn()
    interface: number;

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
    routingRuleInterface: Interface

    @ManyToOne(type => PolicyRule, policyRule => policyRule.routingRuleToInterfaces)
    @JoinColumn({
        name: 'rule'
    })
    policyRule: PolicyRule


    public getTableName(): string {
        return tableName;
    }

}