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

import { SelectQueryBuilder } from 'typeorm';
import { IPObj } from '../ipobj/IPObj';
import { IPObjGroup } from '../ipobj/IPObjGroup';
import { Mark } from '../ipobj/Mark';
import { OpenVPN } from '../vpn/openvpn/OpenVPN';
import { OpenVPNPrefix } from '../vpn/openvpn/OpenVPNPrefix';

export type AvailableDestinations = 'grid' | 'compiler';

export type ItemForGrid = {
  entityId: number;
  id: number; // Item id.
  name: string;
  type: number;
  firewall_id: number;
  firewall_name: string;
  cluster_id: number;
  cluster_name: string;
  host_id?: number;
  host_name?: string;
};

export type RouteItemForCompiler = {
  entityId: number;
  type: number;
  address: string;
  netmask: string;
  range_start: string;
  range_end: string;
};

export type RoutingRuleItemForCompiler = {
  entityId: number;
  type: number;
  address: string;
  netmask: string;
  range_start: string;
  range_end: string;
  mark_code: number;
};

export class RoutingUtils {
  public static async mapEntityData<
    T extends ItemForGrid | RouteItemForCompiler | RoutingRuleItemForCompiler,
  >(
    sql: SelectQueryBuilder<
      IPObj | IPObjGroup | OpenVPN | OpenVPNPrefix | Mark
    >,
    ItemsArrayMap: Map<number, T[]>,
  ): Promise<void> {
    //console.log(sql.getQueryAndParameters());
    const data: T[] = (await sql.getRawMany()) as T[];

    for (let i = 0; i < data.length; i++) {
      const items: T[] = ItemsArrayMap.get(data[i].entityId);
      items?.push(data[i]);
    }

    return;
  }
}
