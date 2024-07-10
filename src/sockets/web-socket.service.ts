/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Service } from '../fonaments/services/service';
import { Channel } from './channels/channel';
import io from 'socket.io';
import { logger } from '../fonaments/abstract-application';
import session from 'express-session';
import { Session } from 'express-session';

export type Payload = object;

export type MessageEvents = 'message:add' | 'message:remove';

declare module 'http' {
  interface IncomingMessage {
    session: Session & Partial<session.SessionData>;
  }
}

export class WebSocketService extends Service {
  protected _channels: Array<Channel> = [];

  protected _socketIO: io.Server;

  public async build(): Promise<WebSocketService> {
    return this;
  }

  get channels(): Array<Channel> {
    return this._channels;
  }

  public hasSocket(socketId: string): boolean {
    return this.getSocket(socketId) !== null;
  }

  public getSocket(socketId: string): io.Socket {
    return this._socketIO.sockets.sockets.get(socketId) || null;
  }

  public setSocketIO(socketIO: io.Server) {
    this._socketIO = socketIO;

    this._socketIO.on('connection', (socket) => {
      // It must exists a session before the socket.io connection.
      if (!socket.request.session) {
        logger().error('WebSocket: Session not found');
        socket.disconnect(true);
        return;
      }

      // Make sure we have session data in store synchronized with the object in memory.
      socket.request.session.reload((err) => {
        if (err && err instanceof Error) {
          logger().error(`WebSocket: Reloading session data from store: ${err.message}`);
          socket.disconnect(true);
          return;
        }

        // Session must contain some mandatory data.
        if (
          !socket.request.session.keepalive_ts ||
          !socket.request.session ||
          !socket.request.session.customer_id ||
          !socket.request.session.user_id ||
          !socket.request.session.username ||
          !socket.request.session.pgp
        ) {
          logger().error('WebSocket: Bad session data.');
          socket.disconnect(true);
          return;
        }

        socket.request.session.socketId = socket.id;
        socket.request.session.save((err) => {
          if (err && err instanceof Error) {
            logger().error(`WebSocket: Storing socket.io id in session file: ${err.message}`);
          } else socket.request.session.reload(() => {});
        });

        logger().info(
          `WebSocket: User connected (ID: ${socket.id}, IP: ${socket.handshake.address}, session: ${socket.request.session.id})`,
        );

        socket.on('disconnect', () => {
          logger().info(
            `WebSocket: User disconnected (ID: ${socket.id}, IP: ${socket.handshake.address}, session: ${socket.request.session.id})`,
          );
        });
      });
    });
  }
}
