/*
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

import * as yargs from "yargs";
import { Application } from "../../Application";
import { RouterService, HttpMethod } from "../../fonaments/http/router/router.service";
import { PathParams } from "express-serve-static-core"
import { Gate } from "../../fonaments/http/router/gate";
import { Route } from "../../fonaments/http/router/route";

interface RouteRow {
    httpMethod: HttpMethod,
    pathParams: PathParams,
    handler: string,
    name: string,
    gates: Array<string>
};


/**
 * Runs migration command.
 */
export class RouteListCommand implements yargs.CommandModule {

    command = "route:list";
    describe = "List all routes";

    builder(args: yargs.Argv) {
        return args;
    }

    async handler(args: yargs.Arguments) {
        const app: Application = await Application.run();

        const routerService: RouterService = await app.getService<RouterService>(RouterService.name);

        try {
            const routes = routerService.getRoutes();
            const rows: Array<RouteRow> = [];

            for (let i = 0; i < routes.length; i++) {
                const route: Route = routes[i];
                rows.push({
                    httpMethod: route.httpMethod,
                    pathParams: route.pathParams,
                    handler: route.isControllerHandler() ? route.controllerSignature.controller.name + '@' + route.controllerSignature.method : 'callback',
                    name: route.name,
                    gates: route.gates.map((gate: typeof Gate) => { return gate.name })
                });
            }

            console.table(rows);
            process.exit(0);
        } catch (err) {
            console.log("Error during migration run:");
            console.error(err);
            process.exit(1);
        }
    }

}