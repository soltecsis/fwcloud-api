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

import { SelectQueryBuilder } from 'typeorm';
import { IPObj } from '../../ipobj/IPObj';
import { IPObjGroup } from '../../ipobj/IPObjGroup';

export type AvailableDestinations = 'haproxy_grid' | 'compiler';

export type ItemForGrid = {
  entityId: number;
  id: number;
  name: string;
  type: number;
  firewall_id: number;
  firewall_name: string;
  cluster_id: number;
  cluster_name: string;
  frontend_ip_id?: number;
  frontend_ip_name?: string;
  frontend_port_id?: number;
  frontend_port_name?: string;
  backend_ip_id?: number;
  backend_ip_name?: string;
};

export type HAProxyRuleItemForCompiler = {
  entityId: number;
  type: number;
  frontend_ip: string;
  frontend_port: string;
  backend_port: string;
  address: string;
  name?: string;
};

export class HAProxyUtils {
  public static async mapEntityData<
    T extends ItemForGrid | HAProxyRuleItemForCompiler,
  >(
    sql: SelectQueryBuilder<IPObj | IPObjGroup>,
    ItemsArrayMap: Map<number, T[]>,
  ): Promise<void> {
    const data: T[] = (await sql.getRawMany()) as T[];

    for (let i = 0; i < data.length; i++) {
      const items: T[] = ItemsArrayMap.get(data[i].entityId);
      items?.push(data[i]);
    }

    return;
  }
}
