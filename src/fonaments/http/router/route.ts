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

import { HttpMethod } from './router.service';
import { PathParams } from 'express-serve-static-core';
import { Controller } from '../controller';
import { Request, Response } from 'express';
import { Gate } from './gate';
import { AbstractApplication, app } from '../../abstract-application';
import { ParamNotValidException } from './exceptions/param-not-valid.exception';
import { ParamMissingException } from './exceptions/param-missing.exception';
import { HTTPApplication } from '../../http-application';

export class ControllerHandlerSignature {
  controller: typeof Controller;
  method: string;
}

export type RequestHandlerCallback = (request: Request, response: Response) => void;

export class Route {
  protected _app: AbstractApplication;
  protected _router: Express.Application;

  protected _pathParams: PathParams;
  protected _httpMethod: HttpMethod;
  protected _controllerSignature?: ControllerHandlerSignature;
  protected _callback?: RequestHandlerCallback;
  protected _validator?: any; //TODO
  protected _gates: Array<typeof Gate>;
  protected _name: string;

  constructor() {
    this._httpMethod = null;
    this._pathParams = null;
    this._controllerSignature = null;
    this._validator = null;
    this._gates = [];
    this._name = null;
    this._app = app();
    this._router = app<HTTPApplication>().express;
  }

  get name(): string {
    return this._name;
  }

  get gates(): Array<typeof Gate> {
    return this._gates;
  }

  get validator(): any {
    return this._validator;
  }

  get httpMethod(): HttpMethod {
    return this._httpMethod;
  }

  get pathParams(): PathParams {
    return this._pathParams;
  }

  get controllerSignature(): ControllerHandlerSignature {
    return this._controllerSignature;
  }

  get callback(): RequestHandlerCallback {
    return this._callback;
  }

  public setHttpMethod(httpMethod: HttpMethod): Route {
    this._httpMethod = httpMethod;
    return this;
  }

  public setPathParams(pathParams: PathParams): Route {
    this._pathParams = pathParams;
    return this;
  }

  public setControllerHandler(controllerHandler: ControllerHandlerSignature): Route {
    this._controllerSignature = controllerHandler;
    return this;
  }

  public setCallbackHandler(callback: RequestHandlerCallback): Route {
    this._callback = callback;
    return this;
  }

  public setName(name: string): Route {
    this._name = name;
    return this;
  }

  public isCallbackHandler(): boolean {
    return this._controllerSignature === null;
  }

  public isControllerHandler(): boolean {
    return this._controllerSignature !== null;
  }

  public setGates(gates: Array<typeof Gate>): Route {
    this._gates = gates;
    return this;
  }

  public generateURL(params: object = {}): string {
    let url: string = this._pathParams.toString();

    for (const param in params) {
      if (Object.prototype.hasOwnProperty.call(params, param)) {
        if (new RegExp('/').test(params[param])) {
          throw new ParamNotValidException(param, params[param], this);
        }

        url = url.replace(new RegExp(':' + param), params[param]);
      }
    }

    //TODO: Should use the regexp path restrictions in order to validate params
    // are valid
    url = url.replace(/ *\([^)]*\)*/g, '');

    const occurrences = url.match(new RegExp(':[A-Za-z0-9]+'));
    if (occurrences && occurrences.length > 0) {
      throw new ParamMissingException(occurrences, this);
    }

    return url;
  }
}
