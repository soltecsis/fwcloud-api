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
import { Service } from '../../services/service';
import { Request, Response, NextFunction } from 'express';
import { RouteCollection as RouteDefinition } from './route-collection';
import { RouterParser } from './router-parser';
import { Route } from './route';
import { AuthorizationException } from '../../exceptions/authorization-exception';
import { ResponseBuilder } from '../response-builder';
import { URLHelper } from './url-helper';
import { Validator } from '../../validation/validator';
import { HttpException } from '../../exceptions/http/http-exception';
import { getFWCloudMetadata } from '../../../metadata/metadata';
import { HTTPApplication } from '../../http-application';
import { ClassConstructor } from 'class-transformer';
import { Routes } from '../../../routes/routes';
import { resolve } from 'path';

export type HttpMethod = 'ALL' | 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'OPTIONS' | 'HEAD';
export type ArgumentTypes<F extends (...args: any) => any> = F extends (...args: infer A) => any
  ? A
  : never;

declare function optionalParams(params: number, params2: string): void;

let _runningURLHelper: URLHelper = null;
export function _URL<T extends URLHelper>(): T {
  return <T>_runningURLHelper;
}

export class RouterService extends Service {
  protected _express: express.Application;
  protected _router: express.Application;

  protected _routes: RouteDefinition;

  protected _list: Array<Route>;

  public getRoutes(): Array<Route> {
    return this._list;
  }

  public async build(): Promise<RouterService> {
    return new Promise((resolve) => {
      this._list = [];
      if (this._app instanceof HTTPApplication) {
        this._express = this._app.express;
        this._router = this._express;
      }
      _runningURLHelper = new URLHelper(this);
      resolve(this);
    });
  }

  public registerRoutes(): void {
    const routes: Array<Route> = this.parseRoutes();

    for (let i = 0; i < routes.length; i++) {
      if (this._app instanceof HTTPApplication) {
        this.registerRoute(routes[i]);
      }
      this._list.push(routes[i]);
    }

    if (this._app instanceof HTTPApplication) {
      //OLD Routes
      this._express.use('/user', require('../../../routes/user/user'));
      this._express.use('/customer', require('../../../routes/user/customer'));
      this._express.use('/fwcloud', require('../../../routes/fwcloud/fwcloud'));
      this._express.use('/cluster', require('../../../routes/firewall/cluster'));
      this._express.use('/firewall', require('../../../routes/firewall/firewall'));
      this._express.use('/policy/rule', require('../../../routes/policy/rule'));
      this._express.use('/policy/compile', require('../../../routes/policy/compile'));
      this._express.use('/policy/install', require('../../../routes/policy/install'));
      this._express.use('/policy/ipobj', require('../../../routes/policy/ipobj'));
      this._express.use('/policy/interface', require('../../../routes/policy/interface'));
      this._express.use('/policy/group', require('../../../routes/policy/group'));
      this._express.use('/policy/types', require('../../../routes/policy/types'));
      this._express.use('/policy/positions', require('../../../routes/policy/positions'));
      this._express.use('/policy/openvpn', require('../../../routes/policy/openvpn'));
      this._express.use('/policy/prefix', require('../../../routes/policy/prefix'));
      this._express.use('/interface', require('../../../routes/interface/interface'));
      this._express.use('/ipobj', require('../../../routes/ipobj/ipobj'));
      this._express.use('/ipobj/group', require('../../../routes/ipobj/group'));
      this._express.use('/ipobj/types', require('../../../routes/ipobj/types'));
      this._express.use('/ipobj/positions', require('../../../routes/ipobj/positions'));
      this._express.use('/ipobj/mark', require('../../../routes/ipobj/mark'));
      this._express.use('/tree', require('../../../routes/tree/tree'));
      this._express.use('/tree/folder', require('../../../routes/tree/folder'));
      this._express.use('/tree/repair', require('../../../routes/tree/repair'));
      this._express.use('/vpn/pki/ca', require('../../../routes/vpn/pki/ca'));
      this._express.use('/vpn/pki/crt', require('../../../routes/vpn/pki/crt'));
      this._express.use('/vpn/pki/prefix', require('../../../routes/vpn/pki/prefix'));
      this._express.use('/vpn/openvpn', require('../../../routes/vpn/openvpn/openvpn'));
      this._express.use('/vpn/openvpn/prefix', require('../../../routes/vpn/openvpn/prefix'));
    }
  }

  public findRouteByName(name: string): Route {
    for (let i = 0; i < this._list.length; i++) {
      if (this._list[i].name === name) {
        return this._list[i];
      }
    }

    return null;
  }

  protected parseRoutes(): Array<Route> {
    const parser = new RouterParser();
    const routes: Routes = new Routes();

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
    this._router[route.httpMethod.toLowerCase()](
      route.pathParams,
      async (request: Request, response: Response, next?: NextFunction) => {
        try {
          if (
            !route.controllerSignature.controller.methodExists(route.controllerSignature.method)
          ) {
            throw new Error(
              'Method ' +
                route.controllerSignature.method +
                ' does not exist in controller: ' +
                route.controllerSignature.controller.name,
            );
          }

          await this.checkGates(route, request);
          await this.validateInput(route, request);
          const controllerInstance = new route.controllerSignature.controller(this._app);
          await controllerInstance.make(request);

          const builder: ResponseBuilder =
            await controllerInstance[route.controllerSignature.method](request);

          if (!builder) {
            throw new Error(
              'Controller handler ' +
                route.controllerSignature.controller.name +
                '@' +
                route.controllerSignature.method +
                ' does not return a response',
            );
          }

          return builder.build(response).send();
        } catch (e) {
          return next(e);
        }
      },
    );

    return route;
  }

  protected async checkGates(route: Route, request: Request): Promise<void> {
    try {
      for (let i = 0; i < route.gates.length; i++) {
        const gate = new route.gates[i]();
        if (!(await gate.grant(request))) {
          throw new AuthorizationException();
        }
      }
    } catch (e) {
      throw new AuthorizationException();
    }
  }

  public async validateInput(route: Route, request: Request): Promise<void> {
    // These routes are already validated with the Joi middleware.
    if (
      route.pathParams === '/iptables-save/import' ||
      route.pathParams === '/iptables-save/export'
    )
      return;

    const validationDto: ClassConstructor<object> =
      getFWCloudMetadata.validations[
        route.controllerSignature.controller.name + '@' + route.controllerSignature.method
      ];

    if (validationDto === undefined) {
      throw new HttpException(`Request ${route.pathParams.toString()} not validated`, 501);
    }

    await new Validator(request.inputs.all(), validationDto).validate();

    const validationQueryDto: ClassConstructor<object> =
      getFWCloudMetadata.queryValidation[
        route.controllerSignature.controller.name + '@' + route.controllerSignature.method
      ];

    if (validationQueryDto) {
      await new Validator(request.query, validationQueryDto).validate({
        enableImplicitConversion: true,
      });
    }
  }
}
