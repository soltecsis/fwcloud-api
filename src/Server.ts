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

import { Application } from "./Application";
import https from 'https';
import http from 'http';
import * as fs from 'fs';
import io from 'socket.io';
import { ConfigurationErrorException } from "./config/exceptions/configuration-error.exception";
import { WebServerApplication } from "./web-server-application";

export class Server {
    private _application: Application | WebServerApplication;
    private _config;
    private _server: https.Server | http.Server;
    private _type: 'api_server' | 'web_server';

    constructor(app: Application | WebServerApplication, type: 'api_server' | 'web_server') {
        this._application = app;
        this._config = app.config;
        this._type = type;
    }

    public async start(): Promise<any> {
        try {
            this.validateApplicationConfiguration();

            if (this._config.get(this._type).enabled) {
                this._server = this.isHttps() ? this.startHttpsServer() : this.startHttpServer();
                this.bootstrapEvents();
                if (this._type === 'api_server') this.bootstrapSocketIO();
            }
            else console.log(`${this._type==='api_server' ? 'API server' : 'WEB server'} not started because it is not enabled.`);
        } catch (error) {
            console.error("ERROR CREATING HTTP/HTTPS SERVER: ", error);
            process.exit(1);
        }

        return this;
    }

    private startHttpsServer(): https.Server {
        const tlsOptions: {
            key: string,
            cert: string,
            ca: string | null
        } = {
            key: fs.readFileSync(this._config.get(this._type).key).toString(),
            cert: fs.readFileSync(this._config.get(this._type).cert).toString(),
            ca: this._config.get(this._type).ca_bundle ? fs.readFileSync(this._config.get(this._type).ca_bundle).toString() : null
        }

        return https.createServer(tlsOptions, this._application.express);
    }

    private startHttpServer(): http.Server {
        return http.createServer(this._application.express);
    }

    private bootstrapEvents() {
        this._server.listen(
            this._config.get(this._type).port,
            this._config.get(this._type).ip
        );

        this._server.on('error', (error: Error) => {
            throw error;
        });

        this._server.on('listening', () => {
            console.log(`${this._type==='api_server' ? 'API server' : 'WEB server'} listening on ` + this.getFullURL())
        })
    }

    private bootstrapSocketIO() {
        const _io: io.Server = io(this._server);
        (<Application>this._application).setSocketIO(_io);

        _io.on('connection', socket => {
            socket.request.session.socket_id = socket.id;
            socket.request.session.save();

            if (this._application.config.get('env') === 'dev') {
                console.log('user connected', socket.id);
            }
            
            socket.on('disconnect', () => {
                if (this._application.config.get('env') === 'dev') {
                    console.log('user disconnected', socket.id);
                }
            });
        });
    }

    protected validateApplicationConfiguration() {
        if (!this._application.config.get('session').secret) {
            throw new ConfigurationErrorException("Configuration Error: Session secret must be defined in .env");
        }

        if (!this._application.config.get('db').pass) {
            throw new ConfigurationErrorException("Configuration Error: Database password must be defined in .env");
        }

        if (!this._application.config.get('crypt').secret) {
            throw new ConfigurationErrorException("Configuration Error: Encryption secret must be defined in .env");
        }

        if (process.env.CORS_WHITELIST) {
            this._application.config.set('CORS.whitelist', process.env.CORS_WHITELIST.replace(/ +/g, '').split(','));
        }
    }

    public isHttps(): boolean {
        return this._config.get(this._type).https;
    }

    protected getFullURL(): string {
        return (this.isHttps() ? 'https' : 'http') + '://' + this._application.config.get(this._type).ip 
        + ':' 
        + this._application.config.get(this._type).port;
    }
}