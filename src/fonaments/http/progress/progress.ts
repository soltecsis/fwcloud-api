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
import { StartTaskPayload, InfoTaskPayload, EndTaskPayload, ErrorTaskPayload, StartProgressPayload, EndProgressPayload } from "./messages/progress-messages";
import * as uuid from "uuid";
import { ProgressPayload } from "../../../sockets/messages/socket-message";

export type taskEventName = 'start' | 'end' | 'info' | 'error';

export type progressEventName = 'start' | 'end';

export interface ExternalEventEmitter extends EventEmitter {
    emit(event: 'message', ...args: any[]): boolean;
}

export interface TasksEventEmitter extends EventEmitter {
    emit(event: taskEventName, ...args: any[]): boolean;
    on(event: taskEventName, listener: (...args: any[]) => void): this;
}

export interface ProgressEventEmitter extends EventEmitter {
    emit(event: progressEventName, ...args: any[]): boolean;
    on(event: progressEventName, listener: (...args: any[]) => void): this;
}

export class Progress {
    protected _id: string;
    protected _externalEmitter: ExternalEventEmitter;
    protected _taskEvents: TasksEventEmitter;
    protected _progressEvents: ProgressEventEmitter;

    protected _failed: boolean;

    protected _startTask: Task;
    
    protected _channel: Channel;

    protected _startMessage: string;
    protected _endMessage: string;
    protected _dataCallback: () => any;

    constructor(eventEmitter: EventEmitter) {
        this._id = uuid.v1();
        this._externalEmitter = eventEmitter;
        this._taskEvents = new EventEmitter();
        this._progressEvents = new EventEmitter();
        this._failed = false;
    }

    get id(): string {
        return this._id;
    }
    
    get startMessage(): string {
        return this._startMessage;
    }

    get endMessage(): string {
        return this._endMessage;
    }

    public procedure(startMessage: string, procedure: GroupDescription, endMessage: string): Promise<void> {
        this._startMessage = startMessage;
        this._endMessage = endMessage;
        
        this._startTask = new SequencedTask(this._taskEvents, procedure);
        return this.run();
    }

    public async run(): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            
            this.bindEvents();

            let heartbeatInterval: NodeJS.Timeout = setInterval(() => {
                this._externalEmitter.emit('message', new ProgressPayload('heartbeat', false, '', this._id))
            }, 20000);
            
            this._progressEvents.emit('start')
            this._startTask.run().then(() => {
                this._progressEvents.emit('end')
                clearInterval(heartbeatInterval);
                return resolve();
            }).catch((e) => {
                clearInterval(heartbeatInterval);
                return reject(e);
            });
        });        
    }

    protected bindEvents(): void {

        this._progressEvents.on('start', () => {
            const message: ProgressPayload = new StartProgressPayload(this);
            this._externalEmitter.emit('message', message);
        });

        this._progressEvents.on('end', async () => {
            this._externalEmitter.emit('message', new EndProgressPayload(this));
        });
        
        this._taskEvents.on('start', (task: Task) => {
            this._externalEmitter.emit('message', new StartTaskPayload(task));
        });

        this._taskEvents.on('info', (task: Task, info: string) => {
            this._externalEmitter.emit('message', new InfoTaskPayload(task, info));
        });

        this._taskEvents.on('end', (task: Task) => {
            this._externalEmitter.emit('message', new EndTaskPayload(task));
        });

        this._taskEvents.on('error', (task: Task, error: Error) => {
            this._externalEmitter.emit('message', new ErrorTaskPayload(task, error));
        });
    }
}