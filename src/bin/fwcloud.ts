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

async function loadApplication(): Promise<Application> {
    const application = await Application.run();
    return application;
}

function startServer(app: Application, type: 'api_server' | 'web_server'): Server {
    const server: Server = new Server(app,type);
    server.start();

    return server;
}


async function start() {
    const app = await loadApplication();

    const api_server: Server = startServer(app,'api_server');
    const web_server: Server = startServer(app,'web_server');
}


start();