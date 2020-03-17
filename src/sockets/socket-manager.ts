import io from 'socket.io';
import { app } from '../fonaments/abstract-application';
import { Application } from '../Application';
import { ResponseBuilder } from '../fonaments/http/response-builder';

export class SocketManager {
    protected _socket: io.Socket;
    protected _scope: string;
    protected _connected: boolean;

    get socket(): io.Socket {
        return this._socket;
    }

    protected constructor(socketId: string, scope: string) {
        if (app<Application>().socketio) {
            this._socket = app<Application>().socketio.sockets.connected[socketId];
        }
        this._scope = scope;

        if (this._socket) {
            this._connected = true;
        }
    }

    public static init(socketId: string, scope: string): SocketManager {
        const instance = new SocketManager(socketId, scope)
        return instance;
    }
    
    public event(data: any, status: number = 200) {
        this.emit(this._scope + ':event', data, status);
    }
  
    public end(data: any, status: number = 200) {
        this.emit(this._scope + ":end", data, status);
    }

    protected emit(scope: string, data: any, status: number) {
        const message: object = ResponseBuilder.buildResponse().status(status).body(data).toJSON();
        if (this._socket) {
            this._socket.emit(this._scope, message);
        }
    }
}