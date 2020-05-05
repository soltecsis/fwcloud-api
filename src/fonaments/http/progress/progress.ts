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

import { EventEmitter } from "typeorm/platform/PlatformTools";
import { SequencedTask } from "./sequenced-task";
import { GroupDescription, Task } from "./task";
import { Channel } from "../../../sockets/channels/channel";
import * as uuid from "uuid";
import { StartProgressPayload, EndProgressPayload, StartTaskPayload, InfoTaskPayload, EndTaskPayload, ErrorTaskPayload } from "./messages/progress-messages";
import { ProgressPayload } from "../../../sockets/messages/socket-message";

export type externalEventName = 'start' | 'end' | 'start_task' | 'end_task' | 'info' | 'error';

export type taskEventName = 'start' | 'end' | 'info' | 'error';

export type progressEventName = 'start' | 'end';

export interface ExternalEventEmitter extends EventEmitter {
    emit(event: externalEventName, ...args: any[]): boolean;
    on(event: externalEventName, listener: (...args: any[]) => void): this;
}

export interface TasksEventEmitter extends EventEmitter {
    emit(event: taskEventName, ...args: any[]): boolean;
    on(event: taskEventName, listener: (...args: any[]) => void): this;
}

export interface ProgressEventEmitter extends EventEmitter {
    emit(event: progressEventName, ...args: any[]): boolean;
    on(event: progressEventName, listener: (...args: any[]) => void): this;
}

export class Progress<T> {
    protected _response: T;
    protected _id: string;
    
    protected _externalEmitter: ExternalEventEmitter;
    protected _taskEvents: TasksEventEmitter;
    protected _progressEvents: ProgressEventEmitter;

    protected _messages: Array<ProgressPayload> = [];

    protected _failed: boolean;

    protected _startTask: Task;
    
    protected _channel: Channel;

    protected _startMessage: string;
    protected _endMessage: string;
    protected _dataCallback: () => any;

    protected _finished: boolean;

    constructor(response: T) {
        this._id = uuid.v1();
        this._response = response;
        this._externalEmitter = new EventEmitter();
        this._taskEvents = new EventEmitter();
        this._progressEvents = new EventEmitter();
        this._failed = false;
        this._messages = [];
        this._finished = false;
    }

    get id(): string {
        return this._id;
    }

    get response(): T {
        return this._response;
    }

    set response(response: T) {
        this._response = response;
    }

    get channel(): Channel {
        return this._channel;
    }

    get startMessage(): string {
        return this._startMessage;
    }

    get endMessage(): string {
        return this._endMessage;
    }

    public procedure(startMessage: string, procedure: GroupDescription, endMessage: string, dataCallback?: () => any): Promise<void> {
        this._startMessage = startMessage;
        this._endMessage = endMessage;
        this._dataCallback = dataCallback ? dataCallback : null;
        
        this._startTask = new SequencedTask(this._taskEvents, procedure);
        return this.run();
    }

    public setChannel(channel: Channel): void {
        this._channel = channel;
        this.sendMessagesToChannel();
        
        //If the channel has been connected after run() process finishes.
        if (this._finished) {
            this.closeChannel();
        }
    }

    public closeChannel(): void {
        if (this._channel) {
            this.channel.close(30000);
        }
    }

    protected sendMessagesToChannel(): void {
        if (this._channel) {
            const messages: Array<ProgressPayload> = this._messages;
            this._messages = [];

            for(let i = 0; i < messages.length; i++) {
                this._channel.addMessage(messages[i]);
            }
        }
    }

    public async run(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            
            this.bindEvents();
            
            this._progressEvents.emit('start')
            this._startTask.run().then(() => {
                this._progressEvents.emit('end');
                this._finished = true;
                return resolve();
            }).catch((e) => {
                return reject(e);
            });
        });        
    }

    protected bindEvents(): void {

        this._progressEvents.on('start', () => {
            const message: ProgressPayload = new StartProgressPayload(this);
            this._messages.push(message);
            this.sendMessagesToChannel();
            this._externalEmitter.emit('start', message);
        });

        this._progressEvents.on('end', async () => {
            const data: any = this._dataCallback ? await this._dataCallback() : null;
            const message: ProgressPayload = new EndProgressPayload(this, data);
            
            this._messages.push(message);
            this.sendMessagesToChannel();
            this.closeChannel();
            this._externalEmitter.emit('end', message);
        });

        this._taskEvents.on('start', (task: Task) => {
            const message: ProgressPayload = new StartTaskPayload(task);
            this._messages.push(message);
            this.sendMessagesToChannel();
            this._externalEmitter.emit('start_task', message);
        });

        this._taskEvents.on('info', (task: Task, info: string) => {
            const message: ProgressPayload = new InfoTaskPayload(task, info);
            this._messages.push(message);
            this.sendMessagesToChannel();
            this._externalEmitter.emit('info', message);
        });

        this._taskEvents.on('end', (task: Task) => {
            const message: ProgressPayload = new EndTaskPayload(task);
            this._messages.push(message);
            this.sendMessagesToChannel();
            this._externalEmitter.emit('end_task', message);
        });

        this._taskEvents.on('error', (task: Task, error: Error) => {
            const message: ProgressPayload = new ErrorTaskPayload(task, error);
            this._messages.push(message);
            this.sendMessagesToChannel();
            this.closeChannel();
            this._externalEmitter.emit('error', error);
        });
    }

    public on(event: externalEventName, listener: (...args: any[]) => void): this {
        this._externalEmitter.on(event, listener);
        return this;
    }

}