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
        if (req.body.socketId) {
            const instance = new SocketTools(req.body.socketId)
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