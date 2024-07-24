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

import { Middleware } from '../fonaments/http/middleware/Middleware';
import session from 'express-session';
import FileStore from 'session-file-store';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AbstractApplication } from '../fonaments/abstract-application';
import { SocketMiddleware } from '../fonaments/http/sockets/socket-middleware';
import { Socket } from 'socket.io';

class Session {
  private static sessionInstance: RequestHandler;

  public static getSession(app: AbstractApplication) {
    if (!Session.sessionInstance) {
      Session.sessionInstance = session({
        name: app.config.get('session').name,
        secret: app.config.get('session').secret,
        //saveUninitialized: true,
        saveUninitialized: false,
        resave: false,
        rolling: false,
        store: new (FileStore(session))({
          path: app.config.get('session').files_path,
          retries: 0,
        }),
        cookie: {
          httpOnly: false,
          secure: app.config.get('session').force_HTTPS, // Enable this when the https is enabled for the API.
        },
      });
    }

    return Session.sessionInstance;
  }
}

export class SessionMiddleware extends Middleware {
  public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        resolve(Session.getSession(this.app)(req, res, next));
      } catch (e) {
        reject(e);
      }
    });
    //next();
  }
}

export class SessionSocketMiddleware extends SocketMiddleware {
  public async handle(socket: Socket, next: NextFunction): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        resolve(Session.getSession(this.app)(socket.request as any, {} as any, next));
      } catch (e) {
        reject(e);
      }
    });
    //next();
  }
}
