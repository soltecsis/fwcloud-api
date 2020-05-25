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
import { Middleware } from "./http/middleware/Middleware";
import { ServiceProvider } from "./services/service-provider";
import { Service } from "./services/service";
import io from 'socket.io';
import * as path from "path";
import { Version } from "../version/version";
import { SessionSocketMiddleware } from "../middleware/Session";
import { SocketMiddleware } from "./http/sockets/socket-middleware";
import { FSHelper } from "../utils/fs-helper";
import { WebSocketService } from "../sockets/web-socket.service";
import winston from "winston";
import { LogServiceProvider } from "../logs/log.provider";
import { LogService } from "../logs/log.service";

declare module 'express-serve-static-core' {
  interface Request {
    dbCon: Query,
    inputs: RequestInputs
  }
}

let _runningApplication: AbstractApplication = null;
export function app<T extends AbstractApplication>(): T {
  return <T>_runningApplication;
}

export function logger(): winston.Logger {
  if (app()) {
    return app().logger;
  }

  return null;
}

export abstract class AbstractApplication {
  static VERSION_FILENAME = 'version.json';

  protected _express: express.Application;
  protected _socketio: any;
  protected _config: any;
  protected _path: string;
  protected _services: ServiceContainer;
  protected _version: Version;
  protected _logger: winston.Logger;

  protected constructor(path: string = process.cwd()) {
    try {
      this._path = path;
      this._express = express();
      this._config = require('../config/config');
      _runningApplication = this;
    } catch (e) {
      console.error('Aplication startup failed: ' + e.message);
      process.exit(e);
    }
  }

  get express(): express.Application {
    return this._express;
  }

  get socketio(): io.Server {
    return this._socketio;
  }

  get config(): any {
    return this._config;
  }

  get path(): string {
    return this._path;
  }

  get version(): Version {
    return this._version;
  }

  get logger(): winston.Logger {
    return this._logger;
  }

  public async getService<T extends Service>(name: string): Promise<T> {
    return this._services.get(name);
  }

  public async setSocketIO(socketIO: io.Server): Promise<io.Server> {
    this._socketio = socketIO;

    const sessionMiddleware: SocketMiddleware = new SessionSocketMiddleware();
    sessionMiddleware.register(this);

    const wsService: WebSocketService = await this.getService<WebSocketService>(WebSocketService.name);
    wsService.setSocketIO(this._socketio);

    return this._socketio;
  }

  public async bootstrap(): Promise<AbstractApplication> {
    this.generateDirectories();
    
    this.startServiceContainer();
    this.registerProviders();
    await this.bootsrapServices();
    
    this._logger = (await this.getService<LogService>(LogService.name)).logger;

    this._version = await this.loadVersion();
    
    this.registerMiddlewares('before');
    await this.registerRoutes();
    this.registerMiddlewares('after');

    return this;
  }

  public async close() {
    await this.stopServiceContainer();
  }

  protected async loadVersion(): Promise<Version> {
    const version: Version = new Version();
    await version.loadVersionFile(path.join(this.path, AbstractApplication.VERSION_FILENAME));

    return version;
  }

  protected registerProviders(): void {
    const providers: Array<any> = [LogServiceProvider].concat(this.providers());
    for (let i = 0; i < providers.length; i++) {
      const provider: ServiceProvider = new (providers[i])()
      provider.register(this._services);
    }
  }

  protected async bootsrapServices(): Promise<void> {
    for (let i = 0; i < this.providers().length; i++) {
      const provider: ServiceProvider = new (this.providers()[i])()
      await provider.bootstrap(this);
    }
  }

  protected startServiceContainer() {
    this._services = new ServiceContainer(this);
  }

  protected async stopServiceContainer(): Promise<void> {
    await this._services.close();
  }

  protected abstract async registerRoutes(): Promise<void>;

  /**
   * Register all middlewares
   */
  protected registerMiddlewares(group: 'before' | 'after'): void {
    let middlewares: Array<any> = [];

    if (group === 'before') {
      middlewares = this.beforeMiddlewares();
      for (let i = 0; i < middlewares.length; i++) {
        const middleware: Middleware = new middlewares[i]();
        middleware.register(this);
      }
    }

    if (group === 'after') {
      middlewares = this.afterMiddlewares();
      for (let i = 0; i < middlewares.length; i++) {
        const middleware: Middleware = new middlewares[i]();
        middleware.register(this);
      }
    }
  }

  /**
   * Returns an array of Middleware classes to be registered before the routes handlers
   */
  protected abstract beforeMiddlewares(): Array<any>;

  /**
   * Returns an array of Middleware classes to be registered after the routes handlers
   */
  protected abstract afterMiddlewares(): Array<any>;

  /**
   * Returns an array of ServiceProviders classes to be bound
   */
  protected abstract providers(): Array<any>;

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
      FSHelper.mkdirSync(this._config.get('policy').data_dir);
      FSHelper.mkdirSync(this._config.get('pki').data_dir);
    } catch (e) {
      if (e.code !== 'EEXIST') {
        console.error("Could not create the data directory. ERROR: ", e);
        process.exit(1);
      }
    }
  }
}