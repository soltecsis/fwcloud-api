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