import { Entity, PrimaryColumn, Column, ManyToOne, JoinTable, ManyToMany, JoinColumn, OneToOne } from "typeorm";
import Model from "../../Model";
import { IPObj } from "../../ipobj/IPObj";
import { OpenVPN } from "./OpenVPN";

const tableName: string = 'openvpn_opt';

@Entity(tableName)
export class OpenVPNOptions extends Model {

    @PrimaryColumn({name: 'openvpn'})
    openVPNId: number;

    @OneToOne(type => OpenVPN, openVPN => openVPN.options)
    @JoinColumn({
        name: 'openvpn'
    })
    openVPN: OpenVPN;

    @Column({name: 'ipobj'})
    ipObjId: number;

    @ManyToOne(type => IPObj, ipObj => ipObj.optionsList)
    @JoinColumn({
        name: 'ipobj'
    })
    ipObj: IPObj;

    @Column()
    name: string;

    @Column()
    arg: string

    @Column()
    order: number;

    @Column()
    scope: number;

    @Column()
    comment: string

    public getTableName(): string {
        return tableName;
    }

}