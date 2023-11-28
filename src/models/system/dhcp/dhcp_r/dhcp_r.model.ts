import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { IPObj } from "../../../ipobj/IPObj";
import { Interface } from "../../../interface/Interface";
import { DHCPGroup } from "../dhcp_g/dhcp_g.model";
import Model from "../../../Model";

const tableName: string = 'dhcp_r';

@Entity(tableName)
export class DHCPRule extends Model{
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'tinyint', default: 1 })
    rule_type: number;

    @Column({ type: 'int' })
    rule_order: number;

    @Column({ type: 'boolean', default: false })
    active: boolean;

    @ManyToOne(() => DHCPGroup)
    @JoinColumn({ name: 'group' })
    group: DHCPGroup;

    @Column({ type: 'varchar', length: 50 })
    style: string;

    @ManyToOne(() => IPObj)
    @JoinColumn({ name: 'network' })
    network: IPObj;

    @ManyToOne(() => IPObj)
    @JoinColumn({ name: 'range' })
    range: IPObj;

    @ManyToOne(() => IPObj)
    @JoinColumn({ name: 'router' })
    router: IPObj;

    @ManyToOne(() => Interface)
    @JoinColumn({ name: 'interface' })
    interface: Interface;

    @Column({ type: 'int', unsigned: true, default: 86400 })
    max_lease: number;

    @Column({ type: 'text' })
    cfg_text: string;

    @Column({ type: 'text' })
    comment: string;

    public getTableName(): string {
        return tableName;
    }
}