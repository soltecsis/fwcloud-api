import { Task } from '../task';
import {
  ProgressPayload,
  ProgressInfoPayload,
  ProgressErrorPayload,
} from '../../../../sockets/messages/socket-message';
import { Progress } from '../progress';

export type TaskPayloadType =
  | 'start'
  | 'end'
  | 'start_task'
  | 'end_task'
  | 'info'
  | 'error';

export class StartProgressPayload extends ProgressPayload {
  constructor(progress: Progress) {
    super('start', false, progress.startMessage, progress.id);
  }
}

export class EndProgressPayload extends ProgressPayload {
  constructor(progress: Progress) {
    super('end', false, progress.startMessage, progress.id);
  }
}

export class StartTaskPayload extends ProgressPayload {
  constructor(task: Task) {
    super('start_task', false, task.description, task.id);
  }
}

export class EndTaskPayload extends ProgressPayload {
  constructor(task: Task) {
    super('end_task', false, task.description, task.id);
  }
}

export class InfoTaskPayload extends ProgressInfoPayload {
  constructor(task: Task, info: string) {
    super(info, false, task.id);
  }
}

export class ErrorTaskPayload extends ProgressErrorPayload {
  constructor(task: Task, error: Error, data: object = null) {
    super(error.message, false, task.id);
  }
}
