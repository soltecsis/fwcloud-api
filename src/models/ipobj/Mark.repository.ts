/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { EntityManager, SelectQueryBuilder } from 'typeorm';
import { Mark } from './Mark';
import { Repository } from '../../database/repository';

//@EntityRepository(Mark)
export class MarkRepository extends Repository<Mark> {
  constructor(manager?: EntityManager) {
    super(Mark, manager);
  }

  getMarksInRoutingRules(
    fwcloud: number,
    firewall: number,
    rules?: number[],
  ): SelectQueryBuilder<Mark> {
    const q = this.createQueryBuilder('mark')
      .select('(select id from ipobj_type where id=30)', 'type')
      .addSelect('null as address')
      .addSelect('null as netmask')
      .addSelect('null as range_start')
      .addSelect('null as range_end')
      .addSelect('mark.code', 'mark_code')
      .addSelect('rule.id', 'entityId')
      .innerJoin('mark.routingRuleToMarks', 'routingRuleToMarks')
      .innerJoin('routingRuleToMarks.routingRule', 'rule')
      .innerJoin('rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });

    return rules ? q.andWhere('rule.id IN (:...rules)', { rules: rules }) : q;
  }

  getMarksInRoutingRules_ForGrid(
    fwcloud: number,
    firewall: number,
  ): SelectQueryBuilder<Mark> {
    return this.createQueryBuilder('mark')
      .select('mark.id', 'id')
      .addSelect('mark.name', 'name')
      .addSelect('(select id from ipobj_type where id=30)', 'type')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .addSelect('rule.id', 'entityId')
      .innerJoin('mark.routingRuleToMarks', 'routingRuleToMarks')
      .addSelect('routingRuleToMarks.order', '_order')
      .innerJoin('routingRuleToMarks.routingRule', 'rule')
      .innerJoin('rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .innerJoin('firewall.fwCloud', 'fwcloud')
      .leftJoin('firewall.cluster', 'cluster')
      .where('fwcloud.id = :fwcloud', { fwcloud: fwcloud })
      .andWhere('firewall.id = :firewall', { firewall: firewall });
  }
}
