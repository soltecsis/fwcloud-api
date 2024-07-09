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
import { AbstractApplication } from './abstract-application';
import * as DatabaseQuery from '../database/Query';
import { RequestInputs } from './http/request-inputs';
import io from 'socket.io';
import { SocketMiddleware } from './http/sockets/socket-middleware';
import { SessionSocketMiddleware } from '../middleware/Session';
import { WebSocketService } from '../sockets/web-socket.service';
import { Middleware } from './http/middleware/Middleware';
import { RouterService } from './http/router/router.service';

declare module 'express-serve-static-core' {
  interface Request {
    dbCon: DatabaseQuery.default;
    inputs: RequestInputs;
  }
}

export abstract class HTTPApplication extends AbstractApplication {
  protected _express: express.Application;
  protected _socketio: io.Server;

  protected constructor(path: string = process.cwd()) {
    try {
      super(path);
      this._express = express();

      /* ATENTION: If etag is not disabled in expres, when fwcloud-api recevies API requests whose data doesn't change respect
            to previous requests, an HTTP 304 "Not Modified" response code is sent back.

            Moreover, in the logs file app.log we can see errors like these ones because we try to send an answer after espress
            has already sent its answer by itself:
                2020-12-04 11:05:16|ERROR|Error [ERR_HTTP_HEADERS_SENT]: Cannot remove headers after they are sent to the client
                2020-12-04 11:05:16|ERROR|    at ServerResponse.removeHeader (_http_outgoing.js:618:11)
                2020-12-04 11:05:16|ERROR|    at ServerResponse.send (/Users/carles/Desktop/FWCloud.net/fwcloud-api/node_modules/express/lib/response.js:210:10)
                2020-12-04 11:05:16|ERROR|    at ResponseBuilder.send (/Users/carles/Desktop/FWCloud.net/fwcloud-api/dist/src/fonaments/http/response-builder.js:94:24)
                2020-12-04 11:05:16|ERROR|    at /Users/carles/Desktop/FWCloud.net/fwcloud-api/dist/src/fonaments/http/router/router.service.js:129:48
                2020-12-04 11:05:16|ERROR|    at runMicrotasks (<anonymous>)
                2020-12-04 11:05:16|ERROR|    at processTicksAndRejections (internal/process/task_queues.js:93:5)

            This happens, for example, in the GET /updates request if the etag is enabled.
            
            The ETag or entity tag is part of HTTP, the protocol for the World Wide Web. 
            It is one of several mechanisms that HTTP provides for Web cache validation, which allows a client to make conditional requests. 
            This allows caches to be more efficient and saves bandwidth, as a Web server does not need to send a full response if the content 
            has not changed. ETags can also be used for optimistic concurrency control,[1] as a way to help prevent simultaneous updates of a 
            resource from overwriting each other.
            */
      this._express.disable('etag');
    } catch (e) {
      console.error('Aplication HTTP startup failed: ' + e.message);
      process.exit(e);
    }
  }

  get express(): express.Application {
    return this._express;
  }

  get socketio(): io.Server {
    return this._socketio;
  }

  public async bootstrap(): Promise<AbstractApplication> {
    await super.bootstrap();

    this.registerMiddlewares('before');

    const routerService: RouterService = await this.getService<RouterService>(RouterService.name);
    routerService.registerRoutes();

    this.registerMiddlewares('after');

    return this;
  }

  public async setSocketIO(socketIO: io.Server): Promise<io.Server> {
    this._socketio = socketIO;

    const sessionMiddleware: SocketMiddleware = new SessionSocketMiddleware();
    sessionMiddleware.register(this);

    const wsService: WebSocketService = await this.getService<WebSocketService>(
      WebSocketService.name,
    );
    wsService.setSocketIO(this._socketio);

    return this._socketio;
  }

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
}
