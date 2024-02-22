/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { IPObj } from "../../../ipobj/IPObj";
import { KeepalivedGroup } from "../keepalived_g/keepalived_g.model";
import Model from "../../../Model";
import { Firewall } from "../../../firewall/Firewall";
import { KeepalivedToIPObj } from "./keepalived_r-to-ipobj";
import { Interface } from "../../../interface/Interface";

const tableName: string = 'keepalived_r';

@Entity(tableName)
export class KeepalivedRule extends Model {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'tinyint', default: 1 })
    rule_type: number;

    @Column({ type: 'int' })
    rule_order: number;

    @Column({ type: 'boolean', default: false })
    active: boolean;

    @ManyToOne(() => KeepalivedGroup)
    @JoinColumn({ name: 'group' })
    group: KeepalivedGroup;

    @Column({ type: 'varchar', length: 50 })
    style: string;

    @ManyToOne(() => Interface, { eager: true })
    @JoinColumn({ name: 'interface' })
    interface: Interface;


    @OneToMany(() => KeepalivedToIPObj, (keepalivedToIPObj) => keepalivedToIPObj.keepalivedRule, {
        cascade: true
    })
    virtualIps: KeepalivedToIPObj[];

    @ManyToOne(() => Firewall, { eager: true })
    @JoinColumn({ name: 'master_node' })
    masterNode: Firewall;

    @ManyToOne(() => Firewall, { eager: true })
    @JoinColumn({ name: 'firewall' })
    firewall: Firewall;

    @Column({ type: 'text' })
    cfg_text: string;

    @Column({ type: 'text' })
    comment: string;

    public getTableName(): string {
        return tableName;
    }
}