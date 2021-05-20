import { Column, Entity, ManyToOne, PrimaryColumn } from "typeorm";
import { Interface } from "../../interface/Interface";
import Model from "../../Model";
import { User } from "../../user/User";
import { RoutingRule } from "../routing-rule/routing-rule.model";

const tableName: string ='routing_r__interface';

@Entity(tableName)
export class RoutingRuleToInterface extends Model {
    
    @PrimaryColumn({
        name: 'rule'
    })
    routingRuleId: number;

    @ManyToOne(() => RoutingRule, routingRule => routingRule.routingRuleToInterfaces)
    routingRule: RoutingRule;

    @PrimaryColumn({
        name: 'interface'
    })
    interfaceId: number;
    @ManyToOne(() => Interface, _interface => _interface.routingRuleToInterfaces)
    interface: Interface;
    

    @Column()
    interface_order: string

    @Column({
        type: Date
    })
	created_at: Date;

	@Column({
        type: Date
    })
	updated_at: Date;

    @Column()
    created_by: number;
    
    @Column()
    updated_by: number;

    public getTableName(): string {
        return tableName;
    }

}