import log4js, { Logger } from 'log4js';
import log4js_extend from 'log4js-extend';

import db from "./database/DatabaseService";

import backupModel from './models/backup/backup';
import { AbstractApplication } from "./fonaments/AbstractApplication";
import { EJS } from "./middleware/EJS";
import { BodyParser } from "./middleware/BodyParser";
import { Compression } from "./middleware/Compression";
import { MethodOverride } from "./middleware/MethodOverride";
import { Session } from "./middleware/Session";
import { CORS } from './middleware/CORS';
import { Authorization } from './middleware/Authorization';
import { ConfirmationToken } from './middleware/ConfirmationToken';
import { InputValidation } from './middleware/InputValidation';
import { AccessControl } from './middleware/AccessControl';
import { AttachDatabaseConnection } from './middleware/AttachDatabaseConnection';
import { Throws404 } from './middleware/Throws404';
import { ErrorResponse } from './middleware/ErrorResponse';
import { RequestBuilder } from './middleware/RequestBuilder';

export class Application extends AbstractApplication {
    private _logger: Logger;

    constructor(path: string = process.cwd()) {
        super();
        try {
            this._logger = this.registerLogger();
        } catch (e) {
            console.error('Aplication startup failed: ' + e.message);
            process.exit(e);
        }
    }

    get logger() {
        return this._logger;
    }

    public async bootstrap() {
        /**
         * We should start the database service before FwCloudMiddlewares 
         * as some of them is using DB
         */
        await this.startDatabaseService();

        await super.bootstrap();

        this.startBackupCronJob();
    }

    protected beforeMiddlewares(): Array<any> {
        return [
            EJS,
            BodyParser,
            RequestBuilder,
            Compression,
            MethodOverride,
            AttachDatabaseConnection,
            Session,
            CORS,
            Authorization,
            ConfirmationToken,
            InputValidation,
            AccessControl
        ];
    }

    protected afterMiddlewares(): Array<any> {
        return [
            Throws404,
            ErrorResponse
        ]
    }

    private registerLogger(): Logger {
        log4js_extend(log4js, {
            path: this._path,
            format: "[@file:@line]"
        });

        this._express.use(log4js.connectLogger(log4js.getLogger("http"), { level: 'auto' }));
        log4js.configure('./config/log4js_configuration.json');

        return log4js.getLogger('app');
    }

    protected async registerRoutes() {
        super.registerRoutes();

        //OLD Routes
        this._express.use('/user', require('./routes/user/user'));
        this._express.use('/customer', require('./routes/user/customer'));
        this._express.use('/fwcloud', require('./routes/fwcloud/fwcloud'));
        this._express.use('/cluster', require('./routes/firewall/cluster'));
        this._express.use('/firewall', require('./routes/firewall/firewall'));
        this._express.use('/policy/rule', require('./routes/policy/rule'));
        this._express.use('/policy/compile', require('./routes/policy/compile'));
        this._express.use('/policy/install', require('./routes/policy/install'));
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

    private startBackupCronJob() {
        backupModel.initCron(this._express);
    }

    private async startDatabaseService() {
        await db.connect();
    }
}