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

import { Application } from '../Application';
import { Server } from '../Server';
import { WebServerApplication } from '../web-server-application';

async function loadApiApplication(): Promise<Application> {
    const application = await Application.run();
    return application;
}

async function loadWebApplication(): Promise<WebServerApplication> {
    const application = await WebServerApplication.run();
    return application;
}

function startServer(app: Application | WebServerApplication, type: 'api_server' | 'web_server'): Server {
    const server: Server = new Server(app,type);
    server.start();
    return server;
}

async function start() {
    let config = require('../config/config');

    const apiApp = await loadApiApplication();
    const api_server: Server = startServer(apiApp,'api_server');

    if (config.get('web_server').enabled) {
        const webApp = await loadWebApplication();
        const web_server: Server = startServer(webApp,'web_server');
        webApp.proxySetup(web_server.server);
    }
}


start();