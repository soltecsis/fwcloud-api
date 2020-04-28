import { WebSocketService } from "../web-socket.service";
import { app } from "../../fonaments/abstract-application";
import * as uuid from "uuid";
import { SocketMessage } from "../messages/socket-message";
import { EventEmitter } from "events";
import io from 'socket.io';

export type ChannelEvent = 'closed' | 'message:add' | 'message:emited';

export interface ChannelEventEmitter extends NodeJS.EventEmitter {
    on(event: ChannelEvent, listener: (...args: any[]) => void): this;
    emit(event: ChannelEvent, ...args: any[]): boolean;
    off(event: ChannelEvent, listener: (...args: any[]) => void): this;
}

function isSocket(object: any): object is io.Socket {
    return 'server' in object &&
        'nsp' in object;
}

export class Channel {
    protected _webSocketService: WebSocketService;
    protected _id: string;

    protected _pendingMessages: Array<SocketMessage>;
    protected _sentMessages: Array<SocketMessage>;

    protected _events: ChannelEventEmitter;

    protected _listener: EventEmitter | io.Socket;
    protected _socketId: string;

    protected _isClosedRequested: boolean;
    protected _closed: boolean;

    protected constructor(webSocketService: WebSocketService) {
        this._id = uuid.v1();
        this._webSocketService = webSocketService;
        this._pendingMessages = [];
        this._sentMessages = [];
        this._events = new EventEmitter();
        this._closed = false;
        this._isClosedRequested = false;
    }

    get id(): string {
        return this._id;
    }

    get pendingMessages(): Array<SocketMessage> {
        return this._pendingMessages;
    }

    get sentMessages(): Array<SocketMessage> {
        return this._sentMessages;
    }

    get closed(): boolean {
        return this._closed;
    }

    public addMessage(payload: object): SocketMessage {
        if (!this.isAcceptingMessages()) {
            return null;
        }

        const message = new SocketMessage(payload, this._id);
        this._pendingMessages.push(message);
        this._events.emit('message:add', message);

        return message;
    }

    protected isAcceptingMessages(): boolean {
        return this._closed === false && this._isClosedRequested === false;
    }

    public setListener(listener: EventEmitter | io.Socket): void {
        if (isSocket(listener) && listener.id !== this._socketId) {
            throw new Error('Channel not allowed');
        }

        this._listener = listener;
    }

    public emitMessages() {
        if (this._listener) {
            const messages = this._pendingMessages;
            this._pendingMessages = [];

            for (let i = 0; i < messages.length; i++) {
                this._listener.emit(this._id, messages[i]);
                this._events.emit('message:emited', messages[i]);
                this._sentMessages.push(messages[i]);
            }
        }
    }

    public close(graceTime: number = 0) {
        if (graceTime > 0) {
            setTimeout(() => { this._close();}, graceTime);
            return;
        }

        this._close();
        return;
    }

    protected _close() {
        this._closed = true;
        this._events.emit('closed');
        this._events.removeAllListeners()
    }

    public on(event: ChannelEvent, listener: (...args: any[]) => void): ChannelEventEmitter {
        return this._events.on(event, listener);
    }

    public static make(webSocketService: WebSocketService): Channel {
        const channel: Channel = new Channel(webSocketService);

        return channel;
    }
}