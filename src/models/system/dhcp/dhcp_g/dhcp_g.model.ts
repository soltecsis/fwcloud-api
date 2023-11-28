import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { Firewall } from "../../../firewall/Firewall";
import { DHCPRule } from "../dhcp_r/dhcp_r.model";
import Model from "../../../Model";

const tableName: string = 'dhcp_g';
@Entity(tableName)
export class DHCPGroup extends Model{
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'varchar', length: 255 })
    name: string;

    @ManyToOne(() => Firewall)
    @JoinColumn({ name: 'firewall' })
    firewall: Firewall;

    @Column({ type: 'varchar', length: 50 })
    style: string;

    @OneToMany(type => DHCPRule,model => model.group, {
        eager: true
    })
    rules: DHCPRule[];

    public getTableName(): string {
        return tableName;
    }
}