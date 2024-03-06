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
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { IPObj } from "../../../ipobj/IPObj";
import { Interface } from "../../../interface/Interface";
import { DHCPGroup } from "../dhcp_g/dhcp_g.model";
import Model from "../../../Model";
import { Firewall } from "../../../firewall/Firewall";
import { DHCPRuleToIPObj } from "./dhcp_r-to-ipobj.model";

const tableName: string = 'dhcp_r';

@Entity(tableName)
export class DHCPRule extends Model {
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

    @ManyToOne(() => DHCPGroup)
    @JoinColumn({ name: 'group' })
    group: DHCPGroup;

    @Column({ type: 'varchar', length: 50 })
    style: string;

    @Column({ name: 'network' })
    networkId: number;

    @ManyToOne(() => IPObj, { eager: true })
    @JoinColumn({ name: 'network' })
    network: IPObj;

    @Column({ name: 'range' })
    rangeId: number;

    @ManyToOne(() => IPObj, { eager: true })
    @JoinColumn({ name: 'range' })
    range: IPObj;

    @Column({ name: 'router' })
    routerId: number;

    @ManyToOne(() => IPObj, { eager: true })
    @JoinColumn({ name: 'router' })
    router: IPObj;

    @Column({ name: 'interface' })
    interfaceId: number;

    @ManyToOne(() => Interface, { eager: true })
    @JoinColumn({ name: 'interface' })
    interface: Interface;

    @OneToMany(() => DHCPRuleToIPObj, model => model.dhcpRule, {
        cascade: true
    })
    dhcpRuleToIPObjs: DHCPRuleToIPObj[];

    @Column({ name: 'firewall' })
    firewallId: number;

    @ManyToOne(() => Firewall)
    @JoinColumn({ name: 'firewall' })
    firewall: Firewall;

    @Column({ type: 'int', unsigned: true, default: 86400 })
    max_lease: number;

    @Column({ type: 'text' })
    cfg_text: string;

    @Column({ type: 'text' })
    comment: string;

    public getTableName(): string {
        return tableName;
    }

    public static async cloneFirewallDHCP(idfirewall: number, idNewFirewall: number) {
        const originalFirewall = await Firewall.findOne(idfirewall);
        const newFirewall = await Firewall.findOne(idNewFirewall);

        if (originalFirewall && newFirewall) {
            const groupMapping = new Map<number, number>();
            const originalDHCPGroups = await DHCPGroup.find({ firewall: originalFirewall });
            for (const group of originalDHCPGroups) {
                const newGroup = new DHCPGroup();
                newGroup.name = group.name;
                newGroup.firewall = newFirewall;
                newGroup.style = group.style;
                await newGroup.save();
                groupMapping.set(group.id, newGroup.id);
            }

            const originalRules = await DHCPRule.find({ firewall: originalFirewall });

            for (const originalRule of originalRules) {
                const newRule = new DHCPRule();
                newRule.rule_type = originalRule.rule_type;
                newRule.rule_order = originalRule.rule_order;
                newRule.active = originalRule.active;
                newRule.style = originalRule.style;
                newRule.network = originalRule.network;
                newRule.range = originalRule.range;
                newRule.router = originalRule.router;
                newRule.interface = originalRule.interface;
                newRule.dhcpRuleToIPObjs = originalRule.dhcpRuleToIPObjs;
                newRule.firewall = newFirewall;
                newRule.max_lease = originalRule.max_lease;
                newRule.cfg_text = originalRule.cfg_text;
                newRule.comment = originalRule.comment;
                if (originalRule.groupId && groupMapping.has(originalRule.groupId)) {
                    newRule.groupId = groupMapping.get(originalRule.groupId);
                }
                await newRule.save();
            }
        }
    }
}