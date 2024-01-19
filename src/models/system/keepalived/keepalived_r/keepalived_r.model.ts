/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { IPObj } from "../../../ipobj/IPObj";
import { KeepalivedGroup } from "../keepalived_g/keepalived_g.model";
import Model from "../../../Model";
import { Firewall } from "../../../firewall/Firewall";

const tableName: string = 'keepalived_r';
//TODO: REVISAR 
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

    @ManyToOne(() => IPObj)
    @JoinColumn({ name: 'interface' })
    interface: IPObj; //INTERFACE ES UNA IP DE UN FIREWALL O CLUSTER

    @ManyToOne(() => IPObj)
    @JoinColumn({ name: 'virtualIp' })
    virtualIp: IPObj;

    @ManyToOne(() => IPObj)
    @JoinColumn({ name: 'masterNode' })
    masterNode: IPObj;

    @ManyToOne(() => Firewall)
    @JoinColumn({ name: 'firewall' })
    firewall: Firewall;

    @Column({ type: 'text' })
    comment: string;

    public getTableName(): string {
        return tableName;
    }
}