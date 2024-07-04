/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { TableExporter } from './table-exporter';
import Model from '../../../models/Model';
import { PolicyRuleToInterface } from '../../../models/policy/PolicyRuleToInterface';
import { SelectQueryBuilder } from 'typeorm';
import { InterfaceExporter } from './interface.exporter';
import { PolicyRule } from '../../../models/policy/PolicyRule';
import { PolicyRuleExporter } from './policy-rule.exporter';
import { Interface } from '../../../models/interface/Interface';

export class PolicyRuleToInterfaceExporter extends TableExporter {
  protected getEntity(): typeof Model {
    return PolicyRuleToInterface;
  }

  public getFilterBuilder(
    qb: SelectQueryBuilder<any>,
    alias: string,
    fwCloudId: number,
  ): SelectQueryBuilder<any> {
    return qb
      .where((qb) => {
        const subquery = qb.subQuery().from(Interface, 'interface').select('interface.id');

        return (
          `${alias}.interfaceId IN ` +
          new InterfaceExporter().getFilterBuilder(subquery, 'interface', fwCloudId).getQuery()
        );
      })
      .orWhere((qb) => {
        const subquery = qb.subQuery().from(PolicyRule, 'policy_r').select('policy_r.id');

        return (
          `${alias}.policyRuleId IN ` +
          new PolicyRuleExporter().getFilterBuilder(subquery, 'policy_r', fwCloudId).getQuery()
        );
      });
  }
}
