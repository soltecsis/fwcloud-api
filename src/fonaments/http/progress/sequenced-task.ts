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

import { Task, GroupDescription, TaskDescription } from './task';
import { ParalellizedTask } from './parallelized-task';
import { TasksEventEmitter } from './progress';

export class SequencedTask extends Task {
  protected _tasks: Array<Task>;

  constructor(eventEmitter: TasksEventEmitter, fn: GroupDescription) {
    super(eventEmitter, null, null);
    fn(this);
  }

  public getTasks(): Array<Task> {
    return this._tasks;
  }

  public addTask(task: TaskDescription, description: string = null): void {
    this._tasks.push(new Task(this._eventEmitter, task, description));
  }

  public parallel(fn: GroupDescription, description: string = null): void {
    this._tasks.push(new ParalellizedTask(this._eventEmitter, fn));
  }

  public sequence(fn: GroupDescription, description: string = null): void {
    this._tasks.push(new SequencedTask(this._eventEmitter, fn));
  }

  public run(): Promise<void> {
    return new Promise((resolve, reject) => {
      for (let i = 0; i < this._tasks.length; i++) {
        try {
          this._tasks[i].run();
        } catch (e) {
          return reject(e);
        }
      }

      return resolve();
    });
  }
}
