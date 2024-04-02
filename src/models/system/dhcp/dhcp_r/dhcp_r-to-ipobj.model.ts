import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import Model from "../../../Model";
import { DHCPRule } from "./dhcp_r.model";
import { IPObj } from "../../../ipobj/IPObj";

const tableName: string = 'dhcp_r__ipobj';

@Entity(tableName)
export class DHCPRuleToIPObj extends Model {
    @PrimaryColumn({
        name: 'rule'
    })
    dhcpRuleId: number;

    @PrimaryColumn({
        name: 'ipobj'
    })
    ipObjId: number;

    @Column({
        type: Number
    })
    order: number;

    @ManyToOne(() => DHCPRule, model => model.dhcpRuleToIPObjs, {
        orphanedRowAction: 'delete'
    })
    @JoinColumn({
        name: 'rule'
    })
    dhcpRule: DHCPRule;

    @ManyToOne(() => IPObj, model => model.dhcpRuleToIPObjs, {
        orphanedRowAction: 'delete'
    })
    @JoinColumn({
        name: 'ipobj'
    })
    ipObj: IPObj;

    public getTableName(): string {
        return tableName;
    }
}