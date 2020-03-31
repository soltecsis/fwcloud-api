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

import { Request } from "express";
import { app } from "../fonaments/abstract-application";
import { Application } from "../Application";
import io from 'socket.io';

let socketTool: SocketTools;

export class SocketTools {
    protected _socket: io.Socket;

    get socket(): io.Socket {
        return this._socket;
    }

    constructor(socketId: string) {
        this._socket = app<Application>().socketio.sockets.connected[socketId];
    }

    public static init(req: Request): SocketTools {
        if (req.body.socketid) {
            const instance = new SocketTools(req.body.socketid)
            socketTool = instance;
            return socketTool;
        }

        return null;
    }
    
    public static msg(data: string) {
        if (socketTool) {
            socketTool.socket.emit('log:info', data)
        };
    }
  
    public static msgEnd = () => {
        if (socketTool) {
            socketTool.socket.emit('log:END')
        }
    }
}