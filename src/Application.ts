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

import express from 'express';
import httpProxy from 'http-proxy';

import log4js, { Logger } from 'log4js';
import log4js_extend from 'log4js-extend';

import db from "./database/database-manager";

import { AbstractApplication } from "./fonaments/abstract-application";
import { BodyParser } from "./middleware/BodyParser";
import { Compression } from "./middleware/Compression";
import { MethodOverride } from "./middleware/MethodOverride";
import { SessionMiddleware, SessionSocketMiddleware } from "./middleware/Session";
import { CORS } from './middleware/cors.middleware';
import { Authorization } from './middleware/Authorization';
import { ConfirmationToken } from './middleware/confirmation-token.middleware';
import { InputValidation } from './middleware/InputValidation';
import { AccessControl } from './middleware/AccessControl';
import { AttachDatabaseConnection } from './middleware/AttachDatabaseConnection';
import { Throws404 } from './middleware/Throws404';
import { ErrorResponse } from './middleware/ErrorResponse';
import { RequestBuilder } from './middleware/RequestBuilder';
import { ServiceProvider } from './fonaments/services/service-provider';
import { BackupServiceProvider } from './backups/backup.provider';
import { CronServiceProvider } from './backups/cron/cron.provider';
import { Middlewareable } from './fonaments/http/middleware/Middleware';
import { AuthorizationTest } from './middleware/AuthorizationTest';
import { SnapshotServiceProvider } from './snapshots/snapshot.provider';
import { MaintenanceMiddleware } from './middleware/maintenance.middleware';
import { DatabaseServiceProvider } from './database/database.provider';
import { RepositoryServiceProvider } from './database/repository.provider';
import { RouterServiceProvider } from './fonaments/http/router/router.provider';
import { AuthorizationServiceProvider } from './fonaments/authorization/authorization.provider';
import { AuthorizationMiddleware } from './fonaments/authorization/authorization.middleware';
import { RouterService } from './fonaments/http/router/router.service';
import { Routes } from './routes/routes';
import { WebSocketServiceProvider } from './sockets/web-socket.provider';
import { FirewallServiceProvider } from './models/firewall/firewall.provider';
import { LogServiceProider } from './logs/log.provider';
import { LogService } from './logs/log.service';

export class Application extends AbstractApplication {
    private _logger: LogService;

    public static async run(): Promise<Application> {
        try {
            const app: Application = new Application();
            await app.bootstrap();
            return app;
        } catch (e) {
            console.error('Application can not start: ' + e.message);
            console.error(e.stack);
            process.exit(1);
        }
    }

    get logger() {
        return this._logger;
    }

    public async bootstrap(): Promise<Application> {
        await super.bootstrap();
        this._logger = await this.registerLogger();
        await this.startDatabaseService()
        return this;
    }

    public async close(): Promise<void> {
        await super.close();
    }

    protected providers(): Array<typeof ServiceProvider> {
        return [
            LogServiceProider,
            DatabaseServiceProvider,
            RepositoryServiceProvider,
            RouterServiceProvider,
            AuthorizationServiceProvider,
            CronServiceProvider,
            BackupServiceProvider,
            SnapshotServiceProvider,
            WebSocketServiceProvider,
            FirewallServiceProvider
        ]
    }

    protected beforeMiddlewares(): Array<Middlewareable> {
        return [
            BodyParser,
            RequestBuilder,
            Compression,
            MethodOverride,
            MaintenanceMiddleware,
            AuthorizationMiddleware,
            AttachDatabaseConnection,
            SessionMiddleware,
            CORS,
            this.config.get('env') !== 'test' ? Authorization : AuthorizationTest,
            ConfirmationToken,
            InputValidation,
            AccessControl
        ];
    }

    protected afterMiddlewares(): Array<Middlewareable> {
        return [
            Throws404,
            ErrorResponse
        ]
    }

    private async registerLogger(): Promise<LogService> {
        return await this.getService<LogService>(LogService.name);
    }

    protected async registerRoutes() {
        const routerService: RouterService = await this.getService<RouterService>(RouterService.name);
        routerService.registerRoutes(Routes);

        //OLD Routes
        this._express.use('/user', require('./routes/user/user'));
        this._express.use('/customer', require('./routes/user/customer'));
        this._express.use('/fwcloud', require('./routes/fwcloud/fwcloud'));
        this._express.use('/cluster', require('./routes/firewall/cluster'));
        this._express.use('/firewall', require('./routes/firewall/firewall'));
        this._express.use('/policy/rule', require('./routes/policy/rule'));
        this._express.use('/policy/compile', require('./routes/policy/compile'));
        this._express.use('/policy/ipobj', require('./routes/policy/ipobj'));
        this._express.use('/policy/interface', require('./routes/policy/interface'));
        this._express.use('/policy/group', require('./routes/policy/group'));
        this._express.use('/policy/types', require('./routes/policy/types'));
        this._express.use('/policy/positions', require('./routes/policy/positions'));
        this._express.use('/policy/openvpn', require('./routes/policy/openvpn'));
        this._express.use('/policy/prefix', require('./routes/policy/prefix'));
        this._express.use('/interface', require('./routes/interface/interface'));
        this._express.use('/ipobj', require('./routes/ipobj/ipobj'));
        this._express.use('/ipobj/group', require('./routes/ipobj/group'));
        this._express.use('/ipobj/types', require('./routes/ipobj/types'));
        this._express.use('/ipobj/positions', require('./routes/ipobj/positions'));
        this._express.use('/ipobj/mark', require('./routes/ipobj/mark'));
        this._express.use('/tree', require('./routes/tree/tree'));
        this._express.use('/tree/folder', require('./routes/tree/folder'));
        this._express.use('/tree/repair', require('./routes/tree/repair'));
        this._express.use('/vpn/pki/ca', require('./routes/vpn/pki/ca'));
        this._express.use('/vpn/pki/crt', require('./routes/vpn/pki/crt'));
        this._express.use('/vpn/pki/prefix', require('./routes/vpn/pki/prefix'));
        this._express.use('/vpn/openvpn', require('./routes/vpn/openvpn/openvpn'));
        this._express.use('/vpn/openvpn/prefix', require('./routes/vpn/openvpn/prefix'));
        this._express.use('/backup', require('./routes/backup/backup'));
    }

    private async startDatabaseService() {
        await db.connect(this);
    }
}
