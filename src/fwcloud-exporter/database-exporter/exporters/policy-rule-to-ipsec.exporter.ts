/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { PolicyRuleToIPSec } from '../../../models/policy/PolicyRuleToIPSec';
import { SelectQueryBuilder } from 'typeorm';
import { PolicyRule } from '../../../models/policy/PolicyRule';
import { PolicyRuleExporter } from './policy-rule.exporter';
import { IPSec } from '../../../models/vpn/ipsec/IPSec';
import { IPSecExporter } from './ipsec.exporter';

export class PolicyRuleToIpsecExporter extends TableExporter {
  protected getEntity(): typeof Model {
    return PolicyRuleToIPSec;
  }

  public getFilterBuilder(
    qb: SelectQueryBuilder<any>,
    alias: string,
    fwCloudId: number,
  ): SelectQueryBuilder<any> {
    return qb
      .where((qb) => {
        const subquery = qb.subQuery().from(PolicyRule, 'policy_r').select('policy_r.id');

        return (
          `${alias}.policyRuleId IN` +
          new PolicyRuleExporter().getFilterBuilder(subquery, 'policy_r', fwCloudId).getQuery()
        );
      })
      .orWhere((qb) => {
        const subquery = qb.subQuery().from(IPSec, 'ipsec').select('ipsec.id');

        return (
          `${alias}.ipsecId IN` +
          new IPSecExporter().getFilterBuilder(subquery, 'ipsec', fwCloudId).getQuery()
        );
      });
  }
}
