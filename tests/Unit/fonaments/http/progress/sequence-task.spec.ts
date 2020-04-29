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

import { describeName, expect } from "../../../../mocha/global-setup";
import { SequencedTask } from "../../../../../src/fonaments/http/progress/sequenced-task";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { Task } from "../../../../../src/fonaments/http/progress/task";

let eventEmitter: EventEmitter;

describe(describeName('Sequence Task tests'), () => {
    beforeEach(async () => {
        eventEmitter = new EventEmitter;
    });

    describe('getTasks()', () => {

        it('should return parallel task added as a task', () => {
            const task = new SequencedTask(eventEmitter, (task: Task) => {
                task.parallel((task) => {
                });
            });

            expect(task.getTasks()).to.have.length(1);
        });

        it('should return sequence task added as a task', () => {
            const task = new SequencedTask(eventEmitter, (task: Task) => {
                task.sequence((task) => {
                });
            });

            expect(task.getTasks()).to.have.length(1);
        });

        it('should return task added as a task', () => {
            const task = new SequencedTask(eventEmitter, (task: Task) => {
                task.addTask(() => { return null; });
            });

            expect(task.getTasks()).to.have.length(1);
        });
    });
});