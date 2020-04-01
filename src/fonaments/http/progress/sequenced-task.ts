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

import { Task, GroupDescription, TaskDescription } from "./task";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { ParalellizedTask } from "./parallelized-task";

export class SequencedTask extends Task {
    protected _tasks: Array<Task>;

    constructor(eventEmitter: EventEmitter, fn: GroupDescription, finishedText: string = null) {
        super(eventEmitter, null, finishedText, false);
        fn(this);
    }

    public getTasks(): Array<Task> {
        return this._tasks;
    }

    public addTask(task: TaskDescription, finishedText: string = null, stepable: boolean = true): void {
        this._tasks.push(new Task(this._eventEmitter, task, finishedText, stepable));
    }

    public parallel(fn: GroupDescription, finishedText: string = null): void {
        this._tasks.push(new ParalellizedTask(this._eventEmitter, fn, finishedText));
    }

    public sequence(fn: GroupDescription, finishedText: string = null): void {
        this._tasks.push(new SequencedTask(this._eventEmitter, fn, finishedText));
    }

    public run(): Promise<any> {
        return new Promise<any>(async (resolve,reject) => {
            for(let i = 0; i < this._tasks.length; i++) {
                await this._tasks[i].run();
                this.emitFinishedTask(this._tasks[i]);
            }

            resolve();
        });
    }
}