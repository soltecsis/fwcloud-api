import { Task } from "../task";
import { Progress } from "../progress";

export type TaskPayloadType = 'start' | 'end' | 'start_task' | 'end_task' | 'info' | 'error';

export class ProgressPayload {
    task_id: string;
    message: string;
    type: TaskPayloadType;
    data: object;

    constructor(payload: {task_id: string, message: string, type: TaskPayloadType}) {
        this.task_id = payload.task_id;
        this.message = payload.message;
        this.type = payload.type;
    }
}

export class StartTaskPayload extends ProgressPayload {
    constructor(task: Task) {
        super({
            task_id: task.id,
            message: task.description,
            type: 'start_task'
        })
    }
}

export class EndTaskPayload extends ProgressPayload {
    constructor(task: Task) {
        super({
            task_id: task.id,
            message: task.description,
            type: 'end_task'
        })
    }
}

export class InfoTaskPayload extends ProgressPayload {
    constructor(task: Task, message: string) {
        super({
            task_id: task.id,
            type: 'info',
            message: message
        });
    }
}

export class ErrorTaskPayload extends ProgressPayload {
    constructor(task: Task, error: Error) {
        super({
            task_id: task.id,
            type: 'error',
            message: 'Error'
        })
    }
}

export class StartProgressPayload extends ProgressPayload {
    constructor(progress: Progress<any>) {
        super({
            task_id: progress.id,
            message: progress.startMessage,
            type: 'start'
        })
    }
}

export class EndProgressPayload extends ProgressPayload {
    constructor(progress: Progress<any>) {
        super({
            task_id: progress.id,
            message: progress.endMessage,
            type: 'end'
        })
    }
}