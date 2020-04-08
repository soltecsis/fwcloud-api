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
import { ProgressState } from '../fonaments/http/progress/progress-state';
import { EventEmitter } from 'events';

export class SocketManager {
    protected _socket: io.Socket;
    protected _connected: boolean;

    protected _isListening: boolean;

    readonly event_id: string;

    protected _messages: Array<object>;

    protected _eventEmitter: EventEmitter

    get socket(): io.Socket {
        return this._socket;
    }

    protected constructor(socket_id: string) {
        if (app<Application>().socketio && socket_id) {
            this._socket = app<Application>().socketio.sockets.connected[socket_id];
        }

        this.event_id = uuid.v1();
        this._messages = [];
        this._eventEmitter = new EventEmitter;
        this._isListening = false;

        if (this._socket) {
            this._connected = true;

            this._socket.on(this.event_id, (_) => {
                this._isListening = true;
                this.emitMessages();
            })
        }
    }

    /**
     * Create a socket message manager
     * 
     * @param socketId 
     */
    public static init(socketId: string): SocketManager {
        const instance = new SocketManager(socketId)
        return instance;
    }

    /**
     * Adds a new message in the stack to be sent using sockets
     * 
     * @param data Message to send
     * @param status Message status
     */
    public send(data: ProgressState): void;
    public send(data: any, status: number = 200): void {
        status = data instanceof ProgressState ? data.status : status;
        const message: object = ResponseBuilder.buildResponse().status(status).body(data).toJSON();
        this._messages.push(message);
        this.emitMessages();
    }

    /**
     * Emit the message stack if there is someone listening
     */
    protected emitMessages(): void {
        if (this._connected && this._isListening) {
            const messages: Array<object> = this.getMessageStackAndRemove();
            messages.forEach((message: object) => {
                this._socket.emit(this.event_id, message);
            });
        }
    }

    /**
     * Get the message stack and remove them from the stack
     */
    protected getMessageStackAndRemove(): Array<object> {
        const messages: Array<object> = this._messages;
        this._messages = [];
        return messages;
    }
}