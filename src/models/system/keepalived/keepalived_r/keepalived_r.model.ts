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
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { IPObj } from '../../../ipobj/IPObj';
import { KeepalivedGroup } from '../keepalived_g/keepalived_g.model';
import Model from '../../../Model';
import { Firewall } from '../../../firewall/Firewall';
import { KeepalivedToIPObj } from './keepalived_r-to-ipobj';
import { Interface } from '../../../interface/Interface';

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

  @Column({ name: 'group' })
  groupId: number;

  @ManyToOne(() => KeepalivedGroup)
  @JoinColumn({ name: 'group' })
  group: KeepalivedGroup;

  @Column({ type: 'varchar', length: 50 })
  style: string;

  @Column({ name: 'interface' })
  interfaceId: number;

  @ManyToOne(() => Interface, { eager: true })
  @JoinColumn({ name: 'interface' })
  interface: Interface;

  @OneToMany(
    () => KeepalivedToIPObj,
    (keepalivedToIPObj) => keepalivedToIPObj.keepalivedRule,
    {
      cascade: true,
    },
  )
  virtualIps: KeepalivedToIPObj[];

  @Column({ name: 'master_node' })
  masterNodeId: number;

  @ManyToOne(() => Firewall, { eager: true })
  @JoinColumn({ name: 'master_node' })
  masterNode: Firewall;

  @Column({ name: 'firewall' })
  firewallId: number;

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

  public static async cloneKeepalived(
    idfirewall: number,
    idNewFirewall: number,
  ): Promise<void> {
    const originalFirewall = await Firewall.findOne({
      where: { id: idfirewall },
    });
    const newFirewall = await Firewall.findOne({
      where: { id: idNewFirewall },
    });

    if (originalFirewall && newFirewall) {
      const groupMapping = new Map<number, number>();
      const originalKeepalivedGroups = await KeepalivedGroup.find({
        where: { firewall: originalFirewall },
      });

      for (const group of originalKeepalivedGroups) {
        const newGroup = new KeepalivedGroup();
        newGroup.name = group.name;
        newGroup.firewall = newFirewall;
        newGroup.style = group.style;
        await newGroup.save();
        groupMapping.set(group.id, newGroup.id);
      }

      const originalKeepalivedRules: KeepalivedRule[] =
        await KeepalivedRule.find({
          where: { firewall: originalFirewall },
          relations: ['virtualIps'],
        });

      for (const originalRule of originalKeepalivedRules) {
        const newRule: KeepalivedRule = new KeepalivedRule();
        newRule.rule_type = originalRule.rule_type;
        newRule.rule_order = originalRule.rule_order;
        newRule.active = originalRule.active;
        newRule.style = originalRule.style;
        newRule.interface = originalRule.interface;
        newRule.masterNode = originalRule.masterNode;
        newRule.firewall = newFirewall;
        newRule.cfg_text = originalRule.cfg_text;
        newRule.comment = originalRule.comment;
        if (originalRule.groupId && groupMapping.has(originalRule.group.id)) {
          newRule.groupId = groupMapping.get(originalRule.group.id);
        }
        await newRule.save();
      }
    }
  }

  public static moveToOtherFirewall(
    src_firewall: number,
    dst_firewall: number,
  ) {
    return KeepalivedRule.createQueryBuilder()
      .update()
      .set({ firewallId: dst_firewall })
      .where('firewallId = :src_firewall', { src_firewall })
      .execute();
  }
}
