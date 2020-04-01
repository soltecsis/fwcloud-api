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

import { AbstractApplication } from "../../abstract-application";
import { Request, Response, NextFunction } from "express";
import { Socket } from "socket.io";

export abstract class SocketMiddleware {
    protected app: AbstractApplication;

    public abstract handle(socket: Socket, next: NextFunction): void;

    private safeHandler(socket: Socket, next: NextFunction) {
        try {
            this.handle(socket, next);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public register(app: AbstractApplication) {
        this.app = app;
        
        app.socketio.use((socket: Socket, next: NextFunction) => {
            this.safeHandler(socket, next);
        })
    }
}