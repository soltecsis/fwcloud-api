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
import { AbstractWebServer } from '../servers/web-server';
import { HttpServer } from '../servers/http-server';
import { HttpsServer } from '../servers/https-server';

async function loadApplication(): Promise<Application> {
    const application = await Application.run();
    return application;
}

async function startServer(app: Application): Promise<AbstractWebServer> {
    let server: AbstractWebServer;
    if (app.config.get('https').enable) {
        server = new HttpsServer(app);
    } else {
        server = new HttpServer(app);
    }
    
    await server.run();

    return server;
}

async function start() {
    const app = await loadApplication();

    await startServer(app);
}


start();