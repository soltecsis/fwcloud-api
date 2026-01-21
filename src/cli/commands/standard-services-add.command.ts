/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import type { Arguments } from 'yargs';
import { DatabaseService } from '../../database/database.service';
import { Command } from '../command';
import { DataSource } from 'typeorm';

/**
 * Command for add new standard services.
 */
export class StandardServicesAddCommand extends Command {
  public name: string = 'standard:services:add';
  public description: string = 'Add new standard services';

  private TCP_services: {
    id: number;
    name: string;
    port: number;
    comment: string;
  }[] = [
    { id: 20091, name: 'fwcloud-api', port: 3131, comment: 'FWCloud API' },
    {
      id: 20092,
      name: 'fwcloud-ui',
      port: 3030,
      comment: 'FWCloud user interface',
    },
    { id: 20093, name: 'fwcloud-agent', port: 33033, comment: 'FWCloud-Agent' },
    { id: 20094, name: 'elasticsearch', port: 9200, comment: 'Elasticsearch' },
    { id: 20095, name: 'kibana', port: 5601, comment: 'Kibana' },
    { id: 20096, name: 'ntopng', port: 3000, comment: 'NtopNG' },
    { id: 20097, name: 'influxdb', port: 8086, comment: 'InfluxDB' },
    {
      id: 20098,
      name: 'websafety-ui',
      port: 8095,
      comment: 'Web Safety Proxy user interface',
    },
    {
      id: 20099,
      name: 'dnssafety-ui',
      port: 8096,
      comment: 'DNS Safety user interface',
    },
    {
      id: 20100,
      name: 'Proxmox PVE',
      port: 8006,
      comment: 'Proxmox Virtual Environment',
    },
    {
      id: 20101,
      name: 'Proxmox PBS',
      port: 8007,
      comment: 'Proxmox Backup Server',
    },
    {
      id: 20102,
      name: 'Checkmk Agent',
      port: 6556,
      comment: 'Checkmk Agent',
    },
    {
      id: 20103,
      name: 'Checkmk Sync',
      port: 6557,
      comment: 'Checkmk sites synchronization',
    },
  ];

  private UDP_services: {
    id: number;
    name: string;
    port: number;
    comment: string;
  }[] = [
    { id: 40034, name: 'WireGuard', port: 51820, comment: 'WireGuard VPN' },
    { id: 40035, name: 'NAT-T', port: 4500, comment: 'NAT Traversal' },
  ];

  private dataSource: DataSource;

  private async getTCPTreeNodes(): Promise<any> {
    const sql = `select SOON.id from fwc_tree SOON 
            inner join fwc_tree FATHER on SOON.id_parent=FATHER.id 
            where FATHER.name='TCP' and FATHER.node_type='SOT' 
            and FATHER.id_obj is null and FATHER.obj_type=2 
            and FATHER.fwcloud is not null 
            and SOON.name='Standard' and SOON.node_type='STD' 
            and SOON.id_obj is null and SOON.obj_type is null 
            and SOON.fwcloud is not null`;

    return await this.dataSource.query(sql);
  }

  private async getUDPTreeNodes(): Promise<any> {
    const sql = `select SOON.id from fwc_tree SOON 
            inner join fwc_tree FATHER on SOON.id_parent=FATHER.id 
            where FATHER.name='UDP' and FATHER.node_type='SOU' 
            and FATHER.id_obj is null and FATHER.obj_type=4 
            and FATHER.fwcloud is not null 
            and SOON.name='Standard' and SOON.node_type='STD' 
            and SOON.id_obj is null and SOON.obj_type is null 
            and SOON.fwcloud is not null`;

    return await this.dataSource.query(sql);
  }

  private async addStandardServices(
    services: { id: number; name: string; port: number; comment: string }[],
    getTreeNodes: () => Promise<any>,
    objType: number,
    nodeType: string,
  ): Promise<void> {
    for (const service of services) {
      // Make sure that the service doesn't exist.
      const exists = await this.dataSource.query(`SELECT id from ipobj where id=${service.id}`);
      if (exists.length) {
        continue;
      }
      this.output.success(
        `Creating new standard ${nodeType === 'SOT' ? 'TCP' : 'UDP'} service: ${service.name}`,
      );
      await this.dataSource.query(
        `INSERT INTO ipobj VALUES(${service.id},NULL,NULL,'${service.name}',${objType},${objType === 2 ? 6 : 17},NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,0,0,${service.port},${service.port},NULL,'${service.comment}',NOW(),NOW(),0,0)`,
      );
    }

    // Add new services to the Standard node of all fwcloud's services tree.
    const nodes = await getTreeNodes();
    for (const node of nodes) {
      for (const service of services) {
        // Make sure that we don't already have a node for this service.
        let sql = `SELECT id from fwc_tree where id_parent=${node.id} and id_obj=${service.id}`;
        const exists = await this.dataSource.query(sql);
        if (exists.length) {
          continue;
        }
        sql = `INSERT INTO fwc_tree
                (name, id_parent, node_type, id_obj, obj_type) 
                VALUES ('${service.name}', ${node.id}, '${nodeType}', ${service.id}, ${objType})`;
        await this.dataSource.query(sql);
      }
    }
  }

  async handle(args: Arguments) {
    const databaseService: DatabaseService = await this._app.getService<DatabaseService>(
      DatabaseService.name,
    );
    this.dataSource = await databaseService.getDataSource({ name: 'cli' });

    await this.addStandardServices(this.TCP_services, this.getTCPTreeNodes.bind(this), 2, 'SOT');
    await this.addStandardServices(this.UDP_services, this.getUDPTreeNodes.bind(this), 4, 'SOU');
  }
}
