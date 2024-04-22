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

import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import Model from "../../../Model";
import { HAProxyGroup } from "../haproxy_g/haproxy_g.model";
import { IPObj } from "../../../ipobj/IPObj";
import { Firewall } from "../../../firewall/Firewall";
import { HAProxyRuleToIPObj } from "./haproxy_r-to_ipobj.model";

const tableName = 'haproxy_r';

@Entity({ name: tableName })
export class HAProxyRule extends Model {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: 'tinyint', default: 1 })
    rule_type: number;

    @Column({ type: 'int' })
    rule_order: number;

    @Column({ type: 'boolean', default: false })
    active: boolean;

    @Column({ name: 'group' })
    groupId: number;

    @ManyToOne(() => HAProxyGroup)
    @JoinColumn({ name: 'group' })
    group: HAProxyGroup;

    @Column({ type: 'varchar', length: 50 })
    style: string;

    @ManyToOne(() => IPObj, { eager: true })
    @JoinColumn({ name: 'frontend_ip' })
    frontendIp: IPObj;

    @ManyToOne(() => IPObj, { eager: true })
    @JoinColumn({ name: 'frontend_port' })
    frontendPort: IPObj;

    @OneToMany(() => HAProxyRuleToIPObj, ruleToIPObj => ruleToIPObj.haproxyRule, { cascade: true })
    backendIps: HAProxyRuleToIPObj[];

    @ManyToOne(() => IPObj, { eager: true })
    @JoinColumn({ name: 'backend_port' })
    backendPort: IPObj;

    @Column({ name: 'firewall' })
    firewallId: number;

    @ManyToOne(() => Firewall)
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