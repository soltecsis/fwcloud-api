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
import { PathParams } from 'express-serve-static-core';
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
import { OperationRegistry } from '../../../authorization/operation-registry';
import { OperationPolicy } from '../../../authorization/operation-policy';
import { registerLegacyOperations } from '../../../authorization/legacy-operation';

type AuditRouteMetadata = {
  httpMethod: HttpMethod;
  path: string | null;
  controller?: string;
  action?: string;
  name?: string | null;
};

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
  private readonly operationRegistry = new OperationRegistry();

  public resolveOperation(method: string, path: string): Readonly<OperationPolicy> | undefined {
    return this.operationRegistry.resolve(method, path);
  }

  private mountLegacyRouter(prefix: string, router: express.Router): void {
    registerLegacyOperations(this.operationRegistry, prefix, router);
    this._express.use(prefix, router);
  }
  protected _express: express.Application;
  protected _router: express.Application;

  protected _routes: RouteDefinition;

  protected _list: Array<Route>;

  public getRoutes(): Array<Route> {
    return this._list;
  }

  public async build(): Promise<RouterService> {
    this._list = [];

    if (this._app instanceof HTTPApplication) {
      this._express = this._app.express;
      this._router = this._express;
      this.registerNumericParamValidators();
    }

    _runningURLHelper = new URLHelper(this);

    return this;
  }

  protected registerNumericParamValidators(): void {
    const numericRouteParams: string[] = [
      'backup',
      'fwcloud',
      'ca',
      'crt',
      'firewall',
      'openvpn',
      'wireguard',
      'ipsec',
      'routingTable',
      'route',
      'dhcpgroup',
      'set',
      'dhcp',
      'keepalivedgroup',
      'keepalived',
      'haproxygroup',
      'haproxy',
      'routeGroup',
      'routingGroup',
      'routingRule',
      'snapshot',
      'auditlog',
    ];

    const digitsOnly = /^\d+$/;

    for (const paramName of numericRouteParams) {
      this._express.param(paramName, (req: Request, res: Response, next: NextFunction, value) => {
        if (!digitsOnly.test(String(value))) {
          res.status(404).end();
          return;
        }
        next();
      });
    }
  }

  public registerRoutes(): void {
    this.operationRegistry.clear();
    const routes: Array<Route> = this.parseRoutes();

    for (let i = 0; i < routes.length; i++) {
      if (this._app instanceof HTTPApplication) {
        this.registerRoute(routes[i]);
      }
      this._list.push(routes[i]);
    }

    if (this._app instanceof HTTPApplication) {
      //OLD Routes
      this.mountLegacyRouter('/user', require('../../../routes/user/user'));
      this._express.use('/customer', require('../../../routes/user/customer'));
      this.mountLegacyRouter('/fwcloud', require('../../../routes/fwcloud/fwcloud'));
      this.mountLegacyRouter('/cluster', require('../../../routes/firewall/cluster'));
      this.mountLegacyRouter('/firewall', require('../../../routes/firewall/firewall'));
      this.mountLegacyRouter('/policy/rule', require('../../../routes/policy/rule'));
      this._express.use('/policy/compile', require('../../../routes/policy/compile'));
      this._express.use('/policy/install', require('../../../routes/policy/install'));
      this._express.use('/policy/ipobj', require('../../../routes/policy/ipobj'));
      this._express.use('/policy/interface', require('../../../routes/policy/interface'));
      this._express.use('/policy/group', require('../../../routes/policy/group'));
      this.mountLegacyRouter('/policy/types', require('../../../routes/policy/types'));
      this.mountLegacyRouter('/policy/positions', require('../../../routes/policy/positions'));
      this._express.use('/policy/openvpn', require('../../../routes/policy/openvpn'));
      this._express.use('/policy/prefix', require('../../../routes/policy/prefix'));
      this.mountLegacyRouter('/interface', require('../../../routes/interface/interface'));
      this.mountLegacyRouter('/ipobj', require('../../../routes/ipobj/ipobj'));
      this.mountLegacyRouter('/ipobj/group', require('../../../routes/ipobj/group'));
      this.mountLegacyRouter('/ipobj/types', require('../../../routes/ipobj/types'));
      this.mountLegacyRouter('/ipobj/positions', require('../../../routes/ipobj/positions'));
      this.mountLegacyRouter('/ipobj/mark', require('../../../routes/ipobj/mark'));
      this.mountLegacyRouter('/tree', require('../../../routes/tree/tree'));
      this._express.use('/tree/folder', require('../../../routes/tree/folder'));
      this._express.use('/tree/repair', require('../../../routes/tree/repair'));
      this._express.use('/vpn/pki/ca', require('../../../routes/vpn/pki/ca'));
      this._express.use('/vpn/pki/crt', require('../../../routes/vpn/pki/crt'));
      this._express.use('/vpn/pki/prefix', require('../../../routes/vpn/pki/prefix'));
      this.mountLegacyRouter('/vpn/openvpn', require('../../../routes/vpn/openvpn/openvpn'));
      this.mountLegacyRouter('/vpn/openvpn/prefix', require('../../../routes/vpn/openvpn/prefix'));
      this._express.use('/policy/wireguard', require('../../../routes/policy/wireguard'));
      this._express.use('/policy/ipsec', require('../../../routes/policy/ipsec'));
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
    if (typeof route.pathParams === 'string') {
      this.operationRegistry.register(route.httpMethod, route.pathParams, route.operationPolicy);
    } else if (route.operationPolicy) {
      throw new Error('Operation policies require a string route template');
    }
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
          const auditMetadata: AuditRouteMetadata = {
            httpMethod: route.httpMethod,
            path: this.normalizeRoutePath(route.pathParams),
            controller: route.controllerSignature?.controller?.name,
            action: route.controllerSignature?.method,
            name: route.name ?? null,
          };

          (request as Request & { __fwcRouteMeta?: AuditRouteMetadata }).__fwcRouteMeta =
            auditMetadata;
          response.locals.__fwcRouteMeta = auditMetadata;

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

  private normalizeRoutePath(pathParams: PathParams): string | null {
    if (typeof pathParams === 'string') {
      return pathParams;
    }

    if (pathParams instanceof RegExp) {
      return pathParams.source;
    }

    if (Array.isArray(pathParams)) {
      return pathParams
        .map((entry) =>
          typeof entry === 'string'
            ? entry
            : entry instanceof RegExp
              ? entry.source
              : String(entry),
        )
        .join('|');
    }

    if (typeof pathParams === 'object' && pathParams !== null) {
      return String(pathParams);
    }

    return null;
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
