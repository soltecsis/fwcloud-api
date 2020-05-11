import { WebSocketService } from "../web-socket.service";
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
    protected _id: string;

    protected _pendingMessages: Array<SocketMessage>;
    protected _sentMessages: Array<SocketMessage>;

    protected _events: ChannelEventEmitter;

    protected _listener: EventEmitter | io.Socket;
    public socketId: string;

    protected _isClosedRequested: boolean;
    protected _closed: boolean;
    protected _closeTimeout: NodeJS.Timeout;

    constructor() {
        this._id = uuid.v1();
        this._pendingMessages = [];
        this._sentMessages = [];
        this._events = new EventEmitter();
        this._closed = false;
        this._isClosedRequested = false;
        this._listener === null;
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
        this.emitMessages();
        this._events.emit('message:add', message);

        return message;
    }

    protected isAcceptingMessages(): boolean {
        return this._closed === false && this._isClosedRequested === false;
    }

    public setListener(listener: EventEmitter | io.Socket, autoemit = true): void {
        if (this._listener) {
            throw new Error('Channel busy');
        }

        this._listener = listener;
        
        if (autoemit) {
            this.emitMessages();    
        }
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

            if(this._isClosedRequested) {
                this._close();
            }
        }
    }

    public close(graceTime: number = 0) {
        if (graceTime > 0 && !this._listener) {
            this._closeTimeout = setTimeout(() => { this._close();}, graceTime);
            this._isClosedRequested = true;
            return;
        }

        this._close();
        return;
    }

    protected _close() {
        this._closed = true;
        this._isClosedRequested = true;
        this._events.emit('closed');
        this._events.removeAllListeners()
        clearTimeout(this._closeTimeout);
    }

    public on(event: ChannelEvent, listener: (...args: any[]) => void): ChannelEventEmitter {
        return this._events.on(event, listener);
    }
}