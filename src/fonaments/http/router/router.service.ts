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

import { Service } from "../../services/service";
import { Request, Response, NextFunction } from "express";
import { RouteCollection as RouteDefinition } from "./route-collection";
import { Routes } from "../../../routes/routes";
import { RouterParser } from "./router-parser";
import { Route } from "./route";
import { AuthorizationException } from "../../exceptions/authorization-exception";
import { RequestValidation } from "../../validation/request-validation";
import { ValidationException } from "../../exceptions/validation-exception";

export type HttpMethod = "ALL" | "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "OPTIONS" | "HEAD";
export type ArgumentTypes<F extends Function> = F extends (...args: infer A) => any ? A : never;
declare function optionalParams(params:number, params2: string): void;


export class RouterService extends Service {
    protected _express: Express.Application;
    protected _router: Express.Application

    protected _routes: RouteDefinition;

    protected _list: Array<Route>

    public getRoutes(): Array<Route> {
        return this._list;
    }

    public async build(): Promise<RouterService> {
        this._express = this._app.express;
        this._router = this._express;
        this._list = [];

        return this;
    }

    public registerRoutes(): void {
        const routes: Array<Route> = this.parseRoutes();

        for(let i = 0; i < routes.length; i++) {
            const route: Route = this.registerRoute(routes[i]);
            this._list.push(route);
        }
    }

    protected parseRoutes(): Array<Route> {

        const parser = new RouterParser();
        const routes: RouteDefinition = new Routes();

        routes.parse(parser);
        parser.commitCurrentRoute();

        return parser.routes;
    }

    protected registerRoute(route: Route): Route {
        if (route.isControllerHandler()) {
            return this.registerControllerHandlerRoute(route);
        }
        
        return this.registerCallbackHandlerRoute(route);
    }

    protected registerCallbackHandlerRoute(route: Route): Route {
        this._router[route.httpMethod.toLowerCase()](route.pathParams, route.callback);
        return route;
    }

    protected registerControllerHandlerRoute(route: Route): Route {
        this._router[route.httpMethod.toLowerCase()](route.pathParams, async (request: Request, response: Response, next?: NextFunction) => {
            try {

                if (!route.controllerSignature.controller.methodExists(route.controllerSignature.method)) {
                    throw new Error('Method ' + route.controllerSignature.method + ' does not exist in controller: ' + route.controllerSignature.controller.name);
                }

                await this.checkGates(route, request);
                await this.validateInput(route, request);

                const controllerInstance = new route.controllerSignature.controller(this._app);
                await controllerInstance.make();

                return await controllerInstance[route.controllerSignature.method](request, response);

            } catch (e) {
                return next(e);
            }
        });

        return route;
    }

    protected async checkGates(route: Route, request: Request): Promise<void> {
        try {
            for (let i = 0; i < route.gates.length; i++) {
                const gate = new route.gates[i]();
                if (! await gate.grant(request)) {
                    throw new AuthorizationException();
                }
            }
        } catch (e) {
            throw new AuthorizationException();
        }
    }

    public async validateInput(route: Route, request: Request): Promise<void> {
        if (route.validator) {
            const validationRequest: RequestValidation = new route.validator(request);
            try {
                await validationRequest.validate();
            } catch (e) {
                throw new ValidationException(e);
            }
        }
    }
}