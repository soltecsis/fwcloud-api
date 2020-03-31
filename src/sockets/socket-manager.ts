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

import io from 'socket.io';
import { app } from '../fonaments/abstract-application';
import { Application } from '../Application';
import { ResponseBuilder } from '../fonaments/http/response-builder';
import * as uuid from "uuid";

export class SocketManager {
    protected _socket: io.Socket;
    protected _connected: boolean;

    readonly event_id: string;

    get socket(): io.Socket {
        return this._socket;
    }

    protected constructor(socket_id: string) {
        if (app<Application>().socketio && socket_id) {
            this._socket = app<Application>().socketio.sockets.connected[socket_id];
        }
        
        if (this._socket) {
            this._connected = true;
        }

        this.event_id = uuid.v1();
    }

    public static init(socketId: string): SocketManager {
        const instance = new SocketManager(socketId)
        return instance;
    }
    
    public event(data: any, status: number = 102) {
        this.emit(this.event_id, data, status);
    }

    public end(data: any) {
        this.emit(this.event_id, data, 200);
    }
  
    protected emit(scope: string, data: any, status: number) {
        const message: object = ResponseBuilder.buildResponse().status(status).body(data).toJSON();
        if (this._socket) {
            this._socket.emit(this.event_id, message);
        }
    }
}