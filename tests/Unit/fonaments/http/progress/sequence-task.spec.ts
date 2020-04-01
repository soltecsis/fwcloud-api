import { describeName, expect } from "../../../../mocha/global-setup";
import { SequencedTask } from "../../../../../src/fonaments/http/progress/sequenced-task";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { Task } from "../../../../../src/fonaments/http/progress/task";

let eventEmitter: EventEmitter;

describe(describeName('Sequence Task tests'), () => {
    beforeEach(async () => {
        eventEmitter = new EventEmitter;
    });

    it('parallel task is added as a task', () => {
        const task = new SequencedTask(eventEmitter, (task: Task) => {
            task.parallel((task) => {
            });
        });

        expect(task.getTasks()).to.have.length(1);
    });

    it('sequence task is added as a task', () => {
        const task = new SequencedTask(eventEmitter, (task: Task) => {
            task.sequence((task) => {
            });
        });

        expect(task.getTasks()).to.have.length(1);
    });

    it('task is added as a task', () => {
        const task = new SequencedTask(eventEmitter, (task: Task) => {
            task.addTask(() => { return null; });
        });

        expect(task.getTasks()).to.have.length(1);
    });

    it('steps should return all task steps', () => {
        const task = new SequencedTask(eventEmitter, (task: Task) => {
            task.addTask(() => { return null; }, '', true);
            task.addTask(() => { return null; }, '', true);
            task.addTask(() => { return null; }, '', false);
            task.parallel((task: Task) => {
                task.addTask(() => { return null; }, '', true);
                task.addTask(() => { return null; }, '', false);
            })
        });

        expect(task.getSteps()).be.deep.eq(3);
    })
})