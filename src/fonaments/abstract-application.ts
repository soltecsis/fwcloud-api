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

import "reflect-metadata";
import express from "express";
import * as fs from 'fs';
import Query from "../database/Query";
import { RequestInputs } from "./http/request-inputs";
import { ServiceContainer } from "./services/service-container";
import { RouterService } from "./http/router/router.service";
import { RouterServiceProvider } from "./http/router/router.provider";
import { AuthorizationServiceProvider } from "./authorization/authorization.provider";
import { AuthorizationMiddleware } from "./authorization/authorization.middleware";
import { DatabaseServiceProvider } from "../database/database.provider";
import { Middleware, Middlewareable } from "./http/middleware/Middleware";
import { ServiceProvider } from "./services/service-provider";
import { Service } from "./services/service";
import { RepositoryServiceProvider } from "../database/repository.provider";

declare module 'express-serve-static-core' {
  interface Request {
    dbCon: Query,
    inputs: RequestInputs
  }
}

let _runningApplication: AbstractApplication = null;

export function app(): AbstractApplication {
  return _runningApplication;
}


export abstract class AbstractApplication {
  protected _express: express.Application;
  protected _config: any;
  protected _path: string;
  protected _services: ServiceContainer;

  private _providers: Array<typeof ServiceProvider> = [
    DatabaseServiceProvider,
    RepositoryServiceProvider,
    RouterServiceProvider,
    AuthorizationServiceProvider
  ];

  private _premiddlewares: Array<Middlewareable> = [
    AuthorizationMiddleware
  ];

  private _postmiddlewares: Array<Middlewareable> = [

  ];

  protected constructor(path: string = process.cwd()) {
    try {
      this._path = path;
      this._express = express();
      this._config = require('../config/config');
      if (this._config.get('env') !== 'test') {
        console.log('Loading application from ' + this._path);
        console.log('Running application in env = ' + this._config.get('env'));
      }
      _runningApplication = this;
    } catch (e) {
      console.error('Aplication startup failed: ' + e.message);
      process.exit(e);
    }
  }

  get express(): express.Application {
    return this._express;
  }

  get config(): any {
    return this._config;
  }

  get path(): string {
    return this._path;
  }

  public async getService<T extends Service>(name: string): Promise<T> {
    return await this._services.get(name);
  }

  public async bootstrap(): Promise<AbstractApplication> {
    this.generateDirectories();
    this.startServiceContainer();
    this.registerProviders();
    this.registerMiddlewares('before');
    await this.registerRoutes();
    this.registerMiddlewares('after');
    return this;
  }

  public async close() {
    await this.stopServiceContainer();
  }

  protected registerProviders(): void {
    const providersArray: Array<any> = this._providers.concat(this.providers());

    for (let i = 0; i < providersArray.length; i++) {
      const provider: ServiceProvider = new providersArray[i]()
      provider.register(this._services);
    }
  }

  protected async registerRoutes() {
    const routerService: RouterService = await this.getService<RouterService>(RouterService.name);
    routerService.registerRoutes();
  };

  protected startServiceContainer() {
    this._services = new ServiceContainer(this);
  }

  protected async stopServiceContainer(): Promise<void> {
    await this._services.close();
  }

  /**
   * Register all middlewares
   */
  protected registerMiddlewares(group: 'before' | 'after'): void {
    let middlewares: Array<any> = [];

    if (group === 'before') {
      middlewares = this._premiddlewares.concat(this.beforeMiddlewares());
      for (let i = 0; i < middlewares.length; i++) {
        const middleware: Middleware = new middlewares[i]();
        middleware.register(this);
      }
    }

    if (group === 'after') {
      middlewares = this.afterMiddlewares().concat(this._postmiddlewares);
      for (let i = 0; i < middlewares.length; i++) {
        const middleware: Middleware = new middlewares[i]();
        middleware.register(this);
      }
    }
  }

  /**
   * Returns an array of Middleware classes to be registered before the routes handlers
   */
  protected beforeMiddlewares(): Array<any> {
    return [];
  }

  /**
   * Returns an array of Middleware classes to be registered after the routes handlers
   */
  protected afterMiddlewares(): Array<any> {
    return [];
  }

  /**
   * Returns an array of ServiceProviders classes to be bound
   */
  protected providers(): Array<any> {
    return [];
  }

  /**
   * Creates autogenerated directories
   */
  private generateDirectories(): void {
    try {
      fs.mkdirSync('./logs');
    } catch (e) {
      if (e.code !== 'EEXIST') {
        console.error("Could not create the logs directory. ERROR: ", e);
        process.exit(1);
      }
    }

    /**
     * Create the data directories, just in case them aren't there.
     */
    try {
      fs.mkdirSync('./DATA');
      fs.mkdirSync(this._config.get('policy').data_dir);
      fs.mkdirSync(this._config.get('pki').data_dir);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        console.error("Could not create the data directory. ERROR: ", e);
        process.exit(1);
      }
    }
  }
}