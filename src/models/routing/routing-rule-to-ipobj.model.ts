import Model from "../Model";
import { PrimaryColumn, Column, ManyToOne, JoinColumn, Entity } from "typeorm";
import { IPObj } from "../ipobj/IPObj";
import { IPObjGroup } from "../ipobj/IPObjGroup";
import { RoutingRule } from "./routing-rule.model";

const tableName: string = 'routing_r__ipobj';

@Entity(tableName)
export class RoutingRuleToIPObj extends Model {
    
    @PrimaryColumn()
    rule: number;

    @PrimaryColumn()
    ipobj: number;

    @PrimaryColumn()
    ipobj_g: number;

    @Column()
    position: number;

    @Column()
    position_orer: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @ManyToOne(type => IPObj, ipObj => ipObj.routingRuleToIPObjs)
    @JoinColumn({
        name: 'ipobj'
    })
    ipObj: IPObj;
    
    @ManyToOne(type => IPObjGroup, ipObjGroup => ipObjGroup.routingRuleToIPObjs)
    @JoinColumn({
        name: 'ipobj_g'
    })
    ipObjGroup: IPObjGroup;
    
    @ManyToOne(type => RoutingRule, routingRule => routingRule.routingRuleToIPObjs)
    @JoinColumn({
        name: 'rule'
    })
    routingRule: RoutingRule;

    public getTableName(): string {
        return tableName;
    }

}