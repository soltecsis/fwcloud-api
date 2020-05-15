import { Task } from "../task";
import { ProgressPayload, ProgressInfoPayload, ProgressErrorPayload } from "../../../../sockets/messages/socket-message";
import { Progress } from "../progress";

export type TaskPayloadType = 'start' | 'end' | 'start_task' | 'end_task' | 'info' | 'error';

export class StartProgressPayload extends ProgressPayload {
    constructor(progress: Progress, data: object = null) {
        super('start', progress.startMessage, data, progress.id)
    }
}

export class EndProgressPayload extends ProgressPayload {
    constructor(progress: Progress, data: object = null) {
        super('end', progress.startMessage, data, progress.id)
    }
}

export class StartTaskPayload extends ProgressPayload {
    constructor(task: Task, data: object = null) {
        super('start_task', task.description, data, task.id)
    }
}

export class EndTaskPayload extends ProgressPayload {
    constructor(task: Task, data: object = null) {
        super('end_task', task.description, data, task.id)
    }
}

export class InfoTaskPayload extends ProgressInfoPayload {
    constructor(task: Task, info: string, data: object = null) {
        super(info, data, task.id)
    }
}

export class ErrorTaskPayload extends ProgressErrorPayload {
    constructor(task: Task, error: Error, data: object = null) {
        super(error.message, data, task.id)
    }
}