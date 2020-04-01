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

export type TaskDescription = () => Promise<any>;
export type GroupDescription = (task: Task) => void

export interface ITask {
    run(): Promise<any>;
    addTask(task: TaskDescription, finishedText: string, stepable: boolean): void;
    parallel(fn: GroupDescription, finishedText: string): void;
    sequence(fn: GroupDescription, finishedText: string): void;
    getSteps(): number;
}
export class Task implements ITask {
    protected _tasks: Array<Task>;
    protected _fn: TaskDescription;
    readonly finishedText: string;
    readonly stepable: boolean;

    protected _eventEmitter: EventEmitter;

    constructor(eventEmitter: EventEmitter, fn: TaskDescription, finishedText: string = null, stepable: boolean = false) {
        this._eventEmitter = eventEmitter;
        this.finishedText = finishedText;
        this.stepable = stepable;
        this._fn = fn;
        this._tasks = [];
    }

    public getSteps(): number {
        let result: number = 0;
        for(let i = 0; i < this._tasks.length; i++) {
            result = result + this._tasks[i].getSteps();
        }

        return result + (this.stepable ? 1 : 0);
    }
    
    addTask(task: TaskDescription, finishedText: string = null, stepable: boolean = true): void {
        throw new Error("Method not implemented.");
    }
    parallel(fn: GroupDescription, finishedText: string = null): void {
        throw new Error("Method not implemented.");
    }
    sequence(fn: GroupDescription, finishedText: string = null): void {
        throw new Error("Method not implemented.");
    }

    public async run(): Promise<any> {
        return this._fn()
    }

    protected emitFinishedTask(task: Task): void {
        if (task.stepable) {
            this._eventEmitter.emit('step', task.finishedText);
        }

        if (task.finishedText) {
            this._eventEmitter.emit('event', task.finishedText);
        }
    }
}