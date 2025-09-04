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
import { DataSource, QueryRunner } from 'typeorm';
import { OpenVPNPrefix } from '../../../models/vpn/openvpn/OpenVPNPrefix';
import { OpenVPNPrefixExporter } from './openvpn-prefix.exporter';
import { IPObjGroupExporter } from './ipobj-group.exporter';
import { IPObjGroup } from '../../../models/ipobj/IPObjGroup';

export class OpenVPNPrefixToIPObjGroupExporter extends TableExporter {
  protected getEntity(): typeof Model {
    return null;
  }

  public getTableName(): string {
    return 'openvpn_prefix__ipobj_g';
  }

  protected async getRows(connection: DataSource, fwCloudId: number): Promise<any> {
    const qr: QueryRunner = connection.createQueryRunner();

    const data = await qr.query(
      `SELECT * FROM ${this.getTableName()} 
        WHERE prefix IN ${this.getOpenVPNPrefixIds(connection, fwCloudId)[0]}
        OR ipobj_g IN ${this.getIpObjGruopIds(connection, fwCloudId)[0]}`,
      this.getOpenVPNPrefixIds(connection, fwCloudId)[1].concat(
        this.getIpObjGruopIds(connection, fwCloudId)[1],
      ),
    );

    await qr.release();

    return data;
  }

  protected getOpenVPNPrefixIds(connection: DataSource, fwCloudId: number): [string, Array<any>] {
    const subquery = connection
      .createQueryBuilder()
      .subQuery()
      .from(OpenVPNPrefix, 'openvpn_prefix')
      .select('openvpn_prefix.id');
    return new OpenVPNPrefixExporter()
      .getFilterBuilder(subquery, 'openvpn_prefix', fwCloudId)
      .getQueryAndParameters();
  }

  protected getIpObjGruopIds(connection: DataSource, fwCloudId: number): [string, Array<any>] {
    const subquery = connection
      .createQueryBuilder()
      .subQuery()
      .from(IPObjGroup, 'ipobj_g')
      .select('ipobj_g.id');
    return new IPObjGroupExporter()
      .getFilterBuilder(subquery, 'ipobj_g', fwCloudId)
      .getQueryAndParameters();
  }
}
