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

import * as path from "path";
import * as fs from 'fs';

import express from "express";
import ejs from 'ejs';
import log4js, { Logger } from 'log4js';
import log4js_extend from 'log4js-extend';
import bodyParser from 'body-parser';
import helmet from 'helmet';
import compression from 'compression';
import method_override from 'method-override';
import cors from 'cors';
import fwcError from './utils/error_table';
import session from 'express-session';
import FileStore from 'session-file-store';
import * as moment from 'moment-timezone';

import accessAuth from './middleware/authorization';
import accessCtrl from './middleware/access_control';
import inputValidation from './middleware/input_validation';
import confirmToken from './middleware/confirmation_token';

import db, { DatabaseService } from "./database/DatabaseService";

import backupModel from './models/backup/backup';

export class Application {
    private _express: express.Application;
    private _config: any;
    private _path: string;
    private _logger: Logger;
    private _db: DatabaseService;


    constructor(path: string = process.cwd()) {
        try {
            this._path = path;
            console.log('Loading application from ' + this._path);
            this._express = express();
            this._config = require('./config/config');
            this._logger = this.registerLogger();
            this._db = db;
        } catch(e) {
            console.error('Aplication startup failed: ' + e.message);
            process.exit(e);
        }
    }

    public async bootstrap() {
        await this.generateDirectories();
        
        /**
         * We should start the database service before FwCloudMiddlewares 
         * as some of them is using DB
         */
        await this.startDatabaseService();
        
        this.registerVendorMiddlewares();
        this.registerFWCloudMiddlewares();
        
        this.startBackupCronJob();

        await this.registerRoutes();

        this.registerCallbacks();
    }

    get express(): express.Application {
        return this._express;
    }

    get config(): any {
        return this._config;
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

    private registerVendorMiddlewares(): void {
        this.registerEjsMiddleware();
        this.registerBodyparserMiddleware();
        this.registerHelmetMiddleware();
        this.registerCompressionMiddleware();
        this.registerMethodOverrideMiddleware();
        this.registerSessionMiddleware();
        this.registerCORSMiddleware();
    }

    private registerFWCloudMiddlewares() {
        this._express.use(accessAuth.check);

        if (this._config.get('confirmation_token')) {
            /** Middleware for manage confirmation token. 
             *  Only required for requests that will change the platform information.
             *  Do this before the input data validation process.
             */
            this._express.use(confirmToken.check);
        }

        // Middleware for input data validation.
        this._express.use(inputValidation.check);

        // Middleware for access control.
        this._express.use(accessCtrl.check);
    }

    private registerCallbacks() {
        // error handlers
        // catch 404 and forward to error handler
        this._express.use((req, res, next) => {
            var err: any = new Error('Not Found');
            err.status = 404;
            next(err);
        });

        // development error handler
        // will print stacktrace
        if (this._express.get('env') === 'dev') {
            this._express.use((err, req, res, next) => {
                this._logger.error("Something went wrong: ", err.message);
                res.status(err.status || 500);
                res.render('error', {
                    message: err.message,
                    error: err
                });
            });
        }

        // production error handler
        // no stacktraces leaked to user
        this._express.use((err, req, res, next) => {
            this._logger.error("Something went wrong: ", err.message);
            res.status(err.status || 500);
            res.render('error', {
                message: err.message,
                error: {}
            });
        });
    }

    private async registerRoutes() {
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

    private registerEjsMiddleware(): void {
        this._express.set('views', path.join(this._path, 'dist', 'src', 'views'));
        this._express.engine('html', ejs.renderFile);
        this._express.set('view engine', 'html');
    }

    private registerBodyparserMiddleware(): void {
        this._express.use(bodyParser.json());
        this._express.use(bodyParser.urlencoded({ extended: false }));
    }

    private registerHelmetMiddleware() {
        this._express.use(helmet());
    }

    private registerCompressionMiddleware(): void {
        this._express.use(compression());
    }

    private registerMethodOverrideMiddleware(): void {
        this._express.use(method_override((req, res) => {
            if (req.body && typeof req.body === 'object' && '_method' in req.body) {
                // look in urlencoded POST bodies and delete it
                var method = req.body._method;
                delete req.body._method;
                return method;
            }
        }));
    }

    private registerCORSMiddleware() {
        const options = {
            credentials: true,
            origin: (origin: string, callback: (error: Error, status?: boolean) => void) => {
                if (this._config.get('CORS').whitelist.indexOf(origin) !== -1) {
                    this._logger.debug('Origin Allowed: ' + origin);
                    callback(null, true);
                } else {
                    this._logger.debug('Origin not allowed by cors: ' + origin);
                    callback(new Error('Origin not allowed by CORS: ' + origin));
                }
            }
        }
        this._express.options('*', cors(options));
        
        // CORS error handler
        this._express.use((err, req, res, next) => {
            res.status(400).send(fwcError.NOT_ALLOWED_CORS);
        });
    }

    private registerSessionMiddleware() {
        const config = {
            name: this._config.get('session').name,
            secret: this._config.get('session').secret,
            saveUninitialized: false,
            resave: true,
            rolling: true,
            store: new (FileStore(session))({
                path: this._config.get('session').files_path
            }),
            cookie: {
                httpOnly: false,
                secure: this._config.get('session').force_HTTPS, // Enable this when the https is enabled for the API.
                maxAge: this._config.get('session').expire * 1000
            }
        }

        this._express.use(session(config));
    }

    private async startDatabaseService() {
        await db.connect();
        
        this._express.use(async (req: any, res, next) => {
            try {
                req.dbCon = db.getQuery();
                next();
            } catch (error) { 
                res.status(400).json(error) 
            }
        });
    }

    private async generateDirectories() {
        try {
            fs.mkdirSync('./logs');
          } catch (e) {
            if (e.code !== 'EEXIST') {
              console.error("Could not create the logs directory. ERROR: ", e);
              process.exit(1);
            }
          }
          
          /**
           * Create the data directories, just in case them aren't there.
           */
          try {
            fs.mkdirSync('./DATA');
            fs.mkdirSync(this._config.get('policy').data_dir);
            fs.mkdirSync(this._config.get('pki').data_dir);
          } catch (e) {
            if (e.code !== 'EEXIST') {
              console.error("Could not create the data directory. ERROR: ", e);
              process.exit(1);
            }
          }
    }
}