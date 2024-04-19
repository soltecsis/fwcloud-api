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

import { Service } from "../fonaments/services/service";
import { Connection, QueryRunner, Migration, getConnectionManager, ConnectionOptions, MigrationExecutor } from "typeorm";
import * as path from "path";
import * as fs from "fs";
import moment from "moment";
import ObjectHelpers from "../utils/object-helpers";
import { FSHelper } from "../utils/fs-helper";
import * as semver from "semver";
import { DatabaseLogger } from "./logger";
import { Cluster } from "../models/firewall/Cluster";
import { Firewall } from "../models/firewall/Firewall";
import { FwCloud } from "../models/fwcloud/FwCloud";
import { Interface } from "../models/interface/Interface";
import { InterfaceIPObj } from "../models/interface/InterfaceIPObj";
import { IPObj } from "../models/ipobj/IPObj";
import { IPObjGroup } from "../models/ipobj/IPObjGroup";
import { IPObjToIPObjGroup } from "../models/ipobj/IPObjToIPObjGroup";
import { IPObjType } from "../models/ipobj/IPObjType";
import { IPObjTypeToPolicyPosition } from "../models/ipobj/IPObjTypeToPolicyPosition";
import { Mark } from "../models/ipobj/Mark";
import { PolicyGroup } from "../models/policy/PolicyGroup";
import { PolicyPosition } from "../models/policy/PolicyPosition";
import { PolicyRule } from "../models/policy/PolicyRule";
import { PolicyRuleToInterface } from "../models/policy/PolicyRuleToInterface";
import { PolicyRuleToIPObj } from "../models/policy/PolicyRuleToIPObj";
import { PolicyRuleToOpenVPN } from "../models/policy/PolicyRuleToOpenVPN";
import { PolicyRuleToOpenVPNPrefix } from "../models/policy/PolicyRuleToOpenVPNPrefix";
import { PolicyType } from "../models/policy/PolicyType";
import { RouteToIPObj } from "../models/routing/route/route-to-ipobj.model";
import { RouteToIPObjGroup } from "../models/routing/route/route-to-ipobj-group.model";
import { RouteToOpenVPN } from "../models/routing/route/route-to-openvpn.model";
import { RouteToOpenVPNPrefix } from "../models/routing/route/route-to-openvpn-prefix.model";
import { Route } from "../models/routing/route/route.model";
import { RouteGroup } from "../models/routing/route-group/route-group.model";
import { RoutingGroup } from "../models/routing/routing-group/routing-group.model";
import { RoutingRuleToIPObjGroup } from "../models/routing/routing-rule/routing-rule-to-ipobj-group.model";
import { RoutingRuleToIPObj } from "../models/routing/routing-rule/routing-rule-to-ipobj.model";
import { RoutingRuleToMark } from "../models/routing/routing-rule/routing-rule-to-mark.model";
import { RoutingRuleToOpenVPNPrefix } from "../models/routing/routing-rule/routing-rule-to-openvpn-prefix.model";
import { RoutingRuleToOpenVPN } from "../models/routing/routing-rule/routing-rule-to-openvpn.model";
import { RoutingRule } from "../models/routing/routing-rule/routing-rule.model";
import { RoutingRuleToInterface } from "../models/routing/routing-rule-to-interface/routing-rule-to-interface.model";
import { RoutingTable } from "../models/routing/routing-table/routing-table.model";
import { FwcTree } from "../models/tree/fwc-tree.model";
import { Customer } from "../models/user/Customer";
import { User } from "../models/user/User";
import { OpenVPNOption } from "../models/vpn/openvpn/openvpn-option.model";
import { OpenVPN } from "../models/vpn/openvpn/OpenVPN";
import { OpenVPNPrefix } from "../models/vpn/openvpn/OpenVPNPrefix";
import { OpenVPNStatusHistory } from "../models/vpn/openvpn/status/openvpn-status-history";
import { Ca } from "../models/vpn/pki/Ca";
import { CaPrefix } from "../models/vpn/pki/CaPrefix";
import { Crt } from "../models/vpn/pki/Crt";
import { Tfa } from "../models/user/Tfa";
import { DHCPRule } from "../models/system/dhcp/dhcp_r/dhcp_r.model";
import { DHCPGroup } from "../models/system/dhcp/dhcp_g/dhcp_g.model";
import { DHCPRuleToIPObj } from "../models/system/dhcp/dhcp_r/dhcp_r-to-ipobj.model";
import { KeepalivedRule } from "../models/system/keepalived/keepalived_r/keepalived_r.model";
import { KeepalivedGroup } from "../models/system/keepalived/keepalived_g/keepalived_g.model";
import { KeepalivedToIPObj } from "../models/system/keepalived/keepalived_r/keepalived_r-to-ipobj";

export interface DatabaseConfig {
    host: string,
    user: string,
    port: number,
    pass: string,
    name: string,
    migrations: Array<string>,
    migration_directory: string,
    debug: boolean
}

export class DatabaseService extends Service {
    protected _id: number;
    protected _connection: Connection;
    protected _config: DatabaseConfig;

    public async build(): Promise<DatabaseService> {
        this._config = this._app.config.get('db');
        this._connection = null;
        this._id = moment().valueOf();

        this._connection = await this.getConnection({name: 'default'});
        
        return this;
    }

    public async close(): Promise<void> {
        const connections: Array<Connection> = getConnectionManager().connections;

        for(let i = 0; i < connections.length; i++) {
            if (connections[i].isConnected) {
                await connections[i].close();
            }
        }
    }

    get config(): any {
        return this._config;
    }

    get connection(): Connection {
        return this._connection;
    }

    public async getConnection(options: Partial<ConnectionOptions>): Promise<Connection> {
        const connectionOptions: ConnectionOptions = <ConnectionOptions>ObjectHelpers.merge(this.getDefaultConnectionConfiguration(), options);
        let connection: Connection;

        connection = getConnectionManager().has(options.name) ? getConnectionManager().get(options.name) : getConnectionManager().create(connectionOptions);
        
        if(!connection.isConnected) {
            await connection.connect();
        }
        
        return connection;
    }

    public async emptyDatabase(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();
        await queryRunner.startTransaction();

        try {
            const tables: Array<string> = await this.getTables(connection);

            let query = 'SET FOREIGN_KEY_CHECKS=0;'
            for (let i = 0; i < tables.length; i++)
                query += `DROP TABLE ${tables[i]};`;
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

    public async isDatabaseEmpty(connection: Connection = null): Promise<boolean> {
        connection = connection ? connection : this._connection;
        
        const queryRunner: QueryRunner = connection.createQueryRunner();
        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);
        await queryRunner.release();
        return result.length === 0;
    }

    public async runMigrations(connection: Connection = null): Promise<Migration[]> {
        connection = connection ? connection : this._connection;
        
        return await connection.runMigrations();
    }

    public async getExecutedMigrations(connection?: Connection): Promise<Migration[]> {
        connection = connection ?? this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();

        const migrationExecutor: MigrationExecutor = new MigrationExecutor(connection, queryRunner);
        const migrations: Migration[] = await migrationExecutor.getExecutedMigrations();
        
        await queryRunner.release();
        
        return migrations;
    }

    public async resetMigrations(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        
        return await this.emptyDatabase(connection);
    }

    public async rollbackMigrations(steps: number = 1, connection?: Connection): Promise<void> {
        connection = connection ?? this._connection;

        for(let i = 0; i < steps; i++) {
            await connection.undoLastMigration();
        }

        return;
    }

    public async feedDefaultData(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;

        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'default.sql'), connection);
        await this.importSQLFile(path.join(process.cwd(), 'config', 'seeds', 'ipobj_std.sql'), connection);
    }

    public async removeData(connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        
        const queryRunner: QueryRunner = connection.createQueryRunner();
        
        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            const tables: Array<string> = await this.getTables(connection);

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
        for(let i = 0; i < directories.length; i++) {
            const directoryName: string = path.basename(directories[i]);
            if(semver.valid(directoryName) && semver.gte(directoryName, version)) {
                version = directoryName;
            }
        }

        return version;
    }

    protected getDefaultConnectionConfiguration(): ConnectionOptions {
        const loggerOptions: ("error" | "query")[] = this._app.config.get('log.queries') ? ['error', 'query'] : ['error'];

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
            cli: {
                migrationsDir: this._config.migration_directory
            },
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
                PolicyType,
                RouteToIPObjGroup,
                RouteToIPObj,
                RouteToOpenVPNPrefix,
                RouteToOpenVPN,
                Route,
                RouteGroup,
                RoutingGroup,
                RoutingRuleToIPObjGroup,
                RoutingRuleToIPObj,
                RoutingRuleToMark,
                RoutingRuleToOpenVPNPrefix,
                RoutingRuleToOpenVPN,
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
                Ca,
                CaPrefix,
                Crt,
                Tfa,
                DHCPRule,
                DHCPGroup,
                DHCPRuleToIPObj,
                KeepalivedRule,
                KeepalivedGroup,
                KeepalivedToIPObj
            ]
        }
    }

    protected async importSQLFile(path: string, connection: Connection = null): Promise<void> {
        connection = connection ? connection : this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();
        const queries = fs.readFileSync(path, { encoding: 'UTF-8' })
            .replace(new RegExp('\'', 'gm'), '"')
            .replace(new RegExp('^--.*\n', 'gm'), '')
            .replace(/(\r\n|\n|\r)/gm, " ")
            .replace(/\s+/g, ' ')
            .split(';');

        await queryRunner.startTransaction();

        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            
            for (let i = 0; i < queries.length; i++) {
                let query = queries[i].trim();
    
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

    protected async getTables(connection: Connection = null): Promise<Array<string>> {
        connection = connection ? connection : this._connection;
        const queryRunner: QueryRunner = connection.createQueryRunner();

        const result: Array<any> = await queryRunner.query('SELECT table_name FROM information_schema.tables WHERE table_schema=?', [this._config.name]);

        const tables: Array<string> = result.map((row) => {
            if (row.hasOwnProperty('table_name')) {
                return row.table_name;
            }

            if (row.hasOwnProperty('TABLE_NAME')) {
                return row.TABLE_NAME;
            }
        })

        await queryRunner.release();

        return tables;
    }
}
