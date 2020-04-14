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


export class WebServerApplication {
    private _express: any;
    private _config: any;
    private _proxy: any;

    protected constructor() {
        try {
            this._express = express();
            this._config = require('./config/config');

            // Proxy requests to fwcloud-api.
            this._proxy = httpProxy.createProxyServer({
                target: this._config.get('web_server').api_url,
                secure: false,
                ws: true
            });
            this.proxySetup();

        } catch (e) {
            console.error('Web Server Application startup failed: ' + e.message);
            process.exit(e);
        }
    }

    private proxySetup(): void {
        try {
            // Proxy API calls.
            this._express.all('/api/*', (req, res) => {
                //console.log(`Proxing request: ${req.url} -> ${this._config.get('web_server').api_url}${req.url.substr(4)}`);
                if (this._config.get('web_server').remove_api_string_from_url) req.url = req.url.substr(4);
                this._proxy.web(req, res);
            });

            // Proxy shocket.io calls.
            this._express.all('/socket.io/*', (req, res) => {
                //console.log(`Proxing request: ${req.url}`);
                this._proxy.web(req, res);
            });

            // Proxy websockets
            this._express.on('upgrade', (req, socket, head) => {
                //console.log(`Proxying upgrade request: ${req.url}`);
                this._proxy.ws(req, socket, head);
            });

            this._proxy.on('error', (err, req, res) => {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end(`ERROR: Proxing request: ${req.url}`);
                console.error(`ERROR: Proxing request: ${req.url} - `, err)
            });

            // Document root for the web server static files.
            this._express.use(express.static(this._config.get('web_server').docroot));

        } catch (e) {
            console.error('Application can not start: ' + e.message);
            console.error(e.stack);
            process.exit(1);
        }
    }

    public static async run(): Promise<WebServerApplication> {
        try {
            const app: WebServerApplication = new WebServerApplication();
            return app;
        } catch (e) {
            console.error('Application can not start: ' + e.message);
            console.error(e.stack);
            process.exit(1);
        }
    }

    get express(): express.Application {
        return this._express;
    }

    get config(): any {
        return this._config;
    }
}