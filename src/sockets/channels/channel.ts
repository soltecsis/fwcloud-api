import * as uuid from "uuid";
import { SocketMessage } from "../messages/socket-message";
import { EventEmitter } from "events";
import { Request } from "express";
import io from 'socket.io';
import { app } from "../../fonaments/abstract-application";
import { WebSocketService } from "../web-socket.service";

export class Channel extends EventEmitter {
    protected _id: string;
    protected _listener: EventEmitter;

    constructor(id: string, listener: EventEmitter) {
        super();
        this._id = uuid.v1();
        this._listener = listener;
    }

    get id(): string {
        return this._id;
    }

    public message(payload: object): boolean {
        const message = new SocketMessage(payload, this._id);
        return this._listener.emit('message', message);
    }

    public emit(event: string | symbol, ...args: any[]): boolean {
        if (event === 'message') {
            return this.message(args[0]);
        }

        return super.emit(event, ...args);
    }

    public static async fromRequest(request: Request): Promise<Channel> {
        const websocketService: WebSocketService = await app().getService<WebSocketService>(WebSocketService.name);
        const id: string = uuid.v1();
        let listener: EventEmitter = new EventEmitter();
        if (request.session.socketId) {
            listener = websocketService.getSocket(request.session.socketId);
        }
        
        return new Channel(id, listener);
    }
    
}