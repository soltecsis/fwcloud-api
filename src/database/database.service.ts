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

import { Service } from '../fonaments/services/service';
import { DataSource, QueryRunner, Migration, DataSourceOptions, MigrationExecutor } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import moment from 'moment';
import ObjectHelpers from '../utils/object-helpers';
import { FSHelper } from '../utils/fs-helper';
import * as semver from 'semver';
import { DatabaseLogger } from './logger';
import { Cluster } from '../models/firewall/Cluster';
import { Firewall } from '../models/firewall/Firewall';
import { FwCloud } from '../models/fwcloud/FwCloud';
import { Interface } from '../models/interface/Interface';
import { InterfaceIPObj } from '../models/interface/InterfaceIPObj';
import { IPObj } from '../models/ipobj/IPObj';
import { IPObjGroup } from '../models/ipobj/IPObjGroup';
import { IPObjToIPObjGroup } from '../models/ipobj/IPObjToIPObjGroup';
import { IPObjType } from '../models/ipobj/IPObjType';
import { IPObjTypeToPolicyPosition } from '../models/ipobj/IPObjTypeToPolicyPosition';
import { Mark } from '../models/ipobj/Mark';
import { PolicyGroup } from '../models/policy/PolicyGroup';
import { PolicyPosition } from '../models/policy/PolicyPosition';
import { PolicyRule } from '../models/policy/PolicyRule';
import { PolicyRuleToInterface } from '../models/policy/PolicyRuleToInterface';
import { PolicyRuleToIPObj } from '../models/policy/PolicyRuleToIPObj';
import { PolicyRuleToOpenVPN } from '../models/policy/PolicyRuleToOpenVPN';
import { PolicyRuleToOpenVPNPrefix } from '../models/policy/PolicyRuleToOpenVPNPrefix';
import { PolicyType } from '../models/policy/PolicyType';
import { RouteToIPObj } from '../models/routing/route/route-to-ipobj.model';
import { RouteToIPObjGroup } from '../models/routing/route/route-to-ipobj-group.model';
import { RouteToOpenVPN } from '../models/routing/route/route-to-openvpn.model';
import { RouteToOpenVPNPrefix } from '../models/routing/route/route-to-openvpn-prefix.model';
import { Route } from '../models/routing/route/route.model';
import { RouteGroup } from '../models/routing/route-group/route-group.model';
import { RoutingGroup } from '../models/routing/routing-group/routing-group.model';
import { RoutingRuleToIPObjGroup } from '../models/routing/routing-rule/routing-rule-to-ipobj-group.model';
import { RoutingRuleToIPObj } from '../models/routing/routing-rule/routing-rule-to-ipobj.model';
import { RoutingRuleToMark } from '../models/routing/routing-rule/routing-rule-to-mark.model';
import { RoutingRuleToOpenVPNPrefix } from '../models/routing/routing-rule/routing-rule-to-openvpn-prefix.model';
import { RoutingRuleToOpenVPN } from '../models/routing/routing-rule/routing-rule-to-openvpn.model';
import { RoutingRule } from '../models/routing/routing-rule/routing-rule.model';
import { RoutingRuleToInterface } from '../models/routing/routing-rule-to-interface/routing-rule-to-interface.model';
import { RoutingTable } from '../models/routing/routing-table/routing-table.model';
import { FwcTree } from '../models/tree/fwc-tree.model';
import { Customer } from '../models/user/Customer';
import { User } from '../models/user/User';
import { OpenVPNOption } from '../models/vpn/openvpn/openvpn-option.model';
import { OpenVPN } from '../models/vpn/openvpn/OpenVPN';
import { OpenVPNPrefix } from '../models/vpn/openvpn/OpenVPNPrefix';
import { OpenVPNStatusHistory } from '../models/vpn/openvpn/status/openvpn-status-history';
import { Ca } from '../models/vpn/pki/Ca';
import { CaPrefix } from '../models/vpn/pki/CaPrefix';
import { Crt } from '../models/vpn/pki/Crt';
import { Tfa } from '../models/user/Tfa';
import { HAProxyRule } from '../models/system/haproxy/haproxy_r/haproxy_r.model';
import { HAProxyGroup } from '../models/system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyRuleToIPObj } from '../models/system/haproxy/haproxy_r/haproxy_r-to_ipobj.model';
import { DHCPRule } from '../models/system/dhcp/dhcp_r/dhcp_r.model';
import { DHCPGroup } from '../models/system/dhcp/dhcp_g/dhcp_g.model';
import { DHCPRuleToIPObj } from '../models/system/dhcp/dhcp_r/dhcp_r-to-ipobj.model';
import { KeepalivedRule } from '../models/system/keepalived/keepalived_r/keepalived_r.model';
import { KeepalivedGroup } from '../models/system/keepalived/keepalived_g/keepalived_g.model';
import { KeepalivedToIPObj } from '../models/system/keepalived/keepalived_r/keepalived_r-to-ipobj';
import { WireGuard } from '../models/vpn/wireguard/WireGuard';
import { WireGuardOption } from '../models/vpn/wireguard/wireguard-option.model';
import { WireGuardPrefix } from '../models/vpn/wireguard/WireGuardPrefix';
import { PolicyRuleToWireGuard } from '../models/policy/PolicyRuleToWireGuard';
import { PolicyRuleToWireGuardPrefix } from '../models/policy/PolicyRuleToWireguardPrefix';
import { RouteToWireGuardPrefix } from '../models/routing/route/route-to-wireguard-prefix.model';
import { RouteToWireGuard } from '../models/routing/route/route-to-wireguard.model';
import { RoutingRuleToWireGuardPrefix } from '../models/routing/routing-rule/routing-rule-to-wireguard-prefix.model';
import { RoutingRuleToWireGuard } from '../models/routing/routing-rule/routing-rule-to-wireguard.model';
import { PolicyRuleToIPSec } from '../models/policy/PolicyRuleToIPSec';
import { PolicyRuleToIPSecPrefix } from '../models/policy/PolicyRuleToIPSecPrefix';
import { RouteToIPSecPrefix } from '../models/routing/route/route-to-ipsec-prefix.model';
import { RouteToIPSec } from '../models/routing/route/route-to-ipsec.model';
import { RoutingRuleToIPSecPrefix } from '../models/routing/routing-rule/routing-rule-to-ipsec-prefix.model';
import { RoutingRuleToIPSec } from '../models/routing/routing-rule/routing-rule-to-ipsec.model';
import { IPSec } from '../models/vpn/ipsec/IPSec';
import { IPSecOption } from '../models/vpn/ipsec/ipsec-option.model';
import { IPSecPrefix } from '../models/vpn/ipsec/IPSecPrefix';
import { AIModel } from '../models/ai-assistant/ai-assistant-models.model';
import { AICredentials } from '../models/ai-assistant/ai-assistant-credentials.model';
import { AI } from '../models/ai-assistant/ai-assistant.model';

export interface DatabaseConfig {
  host: string;
  user: string;
  port: number;
  pass: string;
  name: string;
  migrations: Array<string>;
  migration_directory: string;
  debug: boolean;
}

export class DatabaseService extends Service {
  protected _id: number;
  protected _dataSource: DataSource;
  protected _config: DatabaseConfig;

  public async build(): Promise<DatabaseService> {
    this._config = this._app.config.get('db');
    this._dataSource = null;
    this._id = moment().valueOf();

    this._dataSource = await this.getDataSource({ name: 'default' });

    return this;
  }

  public async close(): Promise<void> {
    const connection: DataSource = this._dataSource;

    if (connection.isInitialized && connection) {
      await connection.destroy();
    }
  }

  get config(): any {
    return this._config;
  }

  get dataSource(): DataSource {
    return this._dataSource;
  }

  public async getDataSource(options: Partial<DataSourceOptions>): Promise<DataSource> {
    const dataSourceOptions: DataSourceOptions = <DataSourceOptions>(
      ObjectHelpers.merge(this.getDefaultDataSourceConfiguration(), options)
    );

    const dataSource: DataSource = new DataSource(dataSourceOptions);

    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    return dataSource;
  }

  public async emptyDatabase(dataSource: DataSource = null): Promise<void> {
    dataSource = dataSource ? dataSource : this._dataSource;
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    await queryRunner.startTransaction();

    try {
      const tables: Array<string> = await this.getTables(dataSource);

      let query = 'SET FOREIGN_KEY_CHECKS=0;';
      for (let i = 0; i < tables.length; i++) query += `DROP TABLE ${tables[i]};`;
      query += 'SET FOREIGN_KEY_CHECKS=1;';

      await queryRunner.query(query);
      await queryRunner.commitTransaction();
      await queryRunner.release();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw e;
    }
  }

  public async isDatabaseEmpty(dataSource: DataSource = null): Promise<boolean> {
    dataSource = dataSource ? dataSource : this._dataSource;

    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    const result: Array<any> = await queryRunner.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema=?',
      [this._config.name],
    );
    await queryRunner.release();
    return result.length === 0;
  }

  public async runMigrations(dataSource: DataSource = null): Promise<Migration[]> {
    dataSource = dataSource ? dataSource : this._dataSource;

    return await dataSource.runMigrations();
  }

  public async getExecutedMigrations(dataSource?: DataSource): Promise<Migration[]> {
    dataSource = dataSource ?? this._dataSource;
    const queryRunner: QueryRunner = dataSource.createQueryRunner();

    const migrationExecutor: MigrationExecutor = new MigrationExecutor(dataSource, queryRunner);
    const migrations: Migration[] = await migrationExecutor.getExecutedMigrations();

    await queryRunner.release();

    return migrations;
  }

  public async resetMigrations(dataSource: DataSource = null): Promise<void> {
    dataSource = dataSource ? dataSource : this._dataSource;

    return await this.emptyDatabase(dataSource);
  }

  public async rollbackMigrations(steps: number = 1, dataSource?: DataSource): Promise<void> {
    dataSource = dataSource ?? this._dataSource;

    for (let i = 0; i < steps; i++) {
      await dataSource.undoLastMigration();
    }

    return;
  }

  public async feedDefaultData(dataSource: DataSource = null): Promise<void> {
    dataSource = dataSource ? dataSource : this._dataSource;

    await this.importSQLFile(
      path.join(process.cwd(), 'config', 'seeds', 'default.sql'),
      dataSource,
    );
    await this.importSQLFile(
      path.join(process.cwd(), 'config', 'seeds', 'ipobj_std.sql'),
      dataSource,
    );
  }

  public async removeData(dataSource: DataSource = null): Promise<void> {
    dataSource = dataSource ? dataSource : this._dataSource;

    const queryRunner: QueryRunner = dataSource.createQueryRunner();

    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

      const tables: Array<string> = await this.getTables(dataSource);

      for (let i = 0; i < tables.length; i++) {
        if (tables[i] !== 'migrations') {
          await queryRunner.query(`TRUNCATE TABLE ${tables[i]}`);
        }
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
      await queryRunner.commitTransaction();
      await queryRunner.release();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw e;
    }

    return;
  }

  public async getSchemaVersion(): Promise<string> {
    let version: string = '0.0.0';

    const directories: Array<string> = await FSHelper.directories(this._config.migration_directory);
    for (let i = 0; i < directories.length; i++) {
      const directoryName: string = path.basename(directories[i]);
      if (semver.valid(directoryName) && semver.gte(directoryName, version)) {
        version = directoryName;
      }
    }

    return version;
  }

  protected getDefaultDataSourceConfiguration(): DataSourceOptions {
    const loggerOptions: ('error' | 'query')[] = this._app.config.get('log.queries')
      ? ['error', 'query']
      : ['error'];

    return {
      type: 'mysql',
      host: this._config.host,
      port: this._config.port,
      database: this._config.name,
      username: this._config.user,
      password: this._config.pass,
      subscribers: [],
      synchronize: false,
      migrationsRun: false,
      dropSchema: false,
      multipleStatements: true, // For optimization purposes. For example, in emptyDatabase() method.
      logger: new DatabaseLogger(loggerOptions),
      migrations: this._config.migrations,
      entities: [
        Cluster,
        Firewall,
        FwCloud,
        Interface,
        InterfaceIPObj,
        IPObj,
        IPObjGroup,
        IPObjToIPObjGroup,
        IPObjType,
        IPObjTypeToPolicyPosition,
        Mark,
        PolicyGroup,
        PolicyPosition,
        PolicyRule,
        PolicyRuleToInterface,
        PolicyRuleToIPObj,
        PolicyRuleToOpenVPN,
        PolicyRuleToOpenVPNPrefix,
        PolicyRuleToWireGuard,
        PolicyRuleToWireGuardPrefix,
        PolicyRuleToIPSec,
        PolicyRuleToIPSecPrefix,
        PolicyType,
        RouteToIPObjGroup,
        RouteToIPObj,
        RouteToOpenVPNPrefix,
        RouteToOpenVPN,
        RouteToWireGuardPrefix,
        RouteToWireGuard,
        RouteToIPSecPrefix,
        RouteToIPSec,
        Route,
        RouteGroup,
        RoutingGroup,
        RoutingRuleToIPObjGroup,
        RoutingRuleToIPObj,
        RoutingRuleToMark,
        RoutingRuleToOpenVPNPrefix,
        RoutingRuleToOpenVPN,
        RoutingRuleToWireGuardPrefix,
        RoutingRuleToWireGuard,
        RoutingRuleToIPSecPrefix,
        RoutingRuleToIPSec,
        RoutingRule,
        RoutingRuleToInterface,
        RoutingTable,
        FwcTree,
        Customer,
        User,
        OpenVPNOption,
        OpenVPN,
        OpenVPNPrefix,
        OpenVPNStatusHistory,
        WireGuardOption,
        WireGuard,
        WireGuardPrefix,
        IPSecOption,
        IPSec,
        IPSecPrefix,
        Ca,
        CaPrefix,
        Crt,
        Tfa,
        HAProxyRule,
        HAProxyGroup,
        HAProxyRuleToIPObj,
        DHCPRule,
        DHCPGroup,
        DHCPRuleToIPObj,
        KeepalivedRule,
        KeepalivedGroup,
        KeepalivedToIPObj,
        AICredentials,
        AIModel,
        AI,
      ],
    };
  }

  protected async importSQLFile(path: string, dataSource: DataSource = null): Promise<void> {
    dataSource = dataSource ? dataSource : this._dataSource;
    const queryRunner: QueryRunner = dataSource.createQueryRunner();
    const queries = fs
      .readFileSync(path, { encoding: 'utf-8' })
      .replace(new RegExp("'", 'gm'), '"')
      .replace(new RegExp('^--.*\n', 'gm'), '')
      .replace(/(\r\n|\n|\r)/gm, ' ')
      .replace(/\s+/g, ' ')
      .split(';');

    await queryRunner.startTransaction();

    try {
      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i].trim();

        if (query !== '') {
          await queryRunner.query(query);
        }
      }

      await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
      await queryRunner.commitTransaction();
      await queryRunner.release();
    } catch (e) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw e;
    }
  }

  protected async getTables(dataSource: DataSource = null): Promise<Array<string>> {
    dataSource = dataSource ? dataSource : this._dataSource;
    const queryRunner: QueryRunner = dataSource.createQueryRunner();

    const result: Array<any> = await queryRunner.query(
      'SELECT table_name FROM information_schema.tables WHERE table_schema=?',
      [this._config.name],
    );

    const tables: Array<string> = result.map((row) => {
      if ('table_name' in row) {
        return row.table_name;
      }

      if ('TABLE_NAME' in row) {
        return row.TABLE_NAME;
      }
    });

    await queryRunner.release();

    return tables;
  }
}
