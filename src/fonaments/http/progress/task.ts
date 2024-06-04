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

import * as uuid from "uuid";
import { TasksEventEmitter } from "./progress";
import { EventEmitter } from "events";

export type TaskDescription = (
  eventEmitter: InternalTaskEventEmitter,
) => Promise<any>;
export type GroupDescription = (task: Task) => void;

export interface InternalTaskEventEmitter extends EventEmitter {
  emit(event: "info", ...args: any[]): boolean;
  on(event: "info", listener: (...args: any[]) => void): this;
}

export interface ITask {
  run(): Promise<any>;
  addTask(task: TaskDescription, finishedText: string, stepable: boolean): void;
  parallel(fn: GroupDescription, finishedText: string): void;
  sequence(fn: GroupDescription, finishedText: string): void;
}
export class Task implements ITask {
  protected _id: string;
  protected _tasks: Array<Task>;
  protected _fn: TaskDescription;
  readonly description: string;
  protected _eventEmitter: TasksEventEmitter;

  protected _internalEmitter: InternalTaskEventEmitter;

  constructor(
    eventEmitter: TasksEventEmitter,
    fn: TaskDescription,
    description: string,
  ) {
    this._id = uuid.v1();
    this._eventEmitter = eventEmitter;
    this._internalEmitter = new EventEmitter();
    this.description = description;
    this._fn = fn;
    this._tasks = [];
  }

  get id(): string {
    return this._id;
  }

  addTask(
    task: TaskDescription,
    finishedText: string = null,
    stepable: boolean = true,
  ): void {
    throw new Error("Method not implemented.");
  }
  parallel(fn: GroupDescription, finishedText: string = null): void {
    throw new Error("Method not implemented.");
  }
  sequence(fn: GroupDescription, finishedText: string = null): void {
    throw new Error("Method not implemented.");
  }

  public async run(): Promise<any> {
    this._internalEmitter.on("info", (message: string) => {
      this.emitInfoTask(this, message);
    });

    this.emitStartedTask(this);
    return this._fn(this._internalEmitter)
      .then(() => {
        this.emitFinishedTask(this);
      })
      .catch((e) => {
        this.emitErrorTask(this, e);
        throw e;
      });
  }

  protected emitInfoTask(task: Task, message: string): void {
    this._eventEmitter.emit("info", task, message);
  }

  protected emitStartedTask(task: Task): void {
    this._eventEmitter.emit("start", task);
  }

  protected emitFinishedTask(task: Task): void {
    this._eventEmitter.emit("end", task);
  }

  protected emitErrorTask(task: Task, error: Error): void {
    this._eventEmitter.emit("error", task, error);
  }
}
