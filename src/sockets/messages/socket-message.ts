import moment from 'moment';
import * as uuid from 'uuid';

export class SocketMessage {
  id: string;
  timestamp: number;
  channel: string;
  payload: object;

  constructor(payload: SocketMessagePayload | object, channel: string = null) {
    this.id = uuid.v1();
    this.timestamp = moment().valueOf();
    this.channel = channel;
    this.payload = payload;
  }
}

export class SocketMessagePayload {}

export type StatusType =
  | 'start'
  | 'end'
  | 'start_task'
  | 'end_task'
  | 'notice'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'heartbeat'
  | 'ssh_cmd_output';

export class ProgressPayload extends SocketMessagePayload {
  readonly task_id?: string;
  readonly type: StatusType;
  readonly highlight: boolean;
  readonly message: string;

  constructor(
    type: StatusType,
    hightlight: boolean = false,
    message: string,
    task_id: string = null,
  ) {
    super();
    this.type = type;
    this.message = message;
    this.highlight = hightlight;
    this.task_id = task_id;
  }
}

export class ProgressNoticePayload extends ProgressPayload {
  constructor(message: string, highlight: boolean = false, task_id: string = null) {
    super('notice', highlight, message, task_id);
  }
}

export class ProgressInfoPayload extends ProgressPayload {
  constructor(message: string, highlight: boolean = false, task_id: string = null) {
    super('info', highlight, message, task_id);
  }
}

export class ProgressSuccessPayload extends ProgressPayload {
  constructor(message: string, highlight: boolean = false, task_id: string = null) {
    super('success', highlight, message, task_id);
  }
}

export class ProgressWarningPayload extends ProgressPayload {
  constructor(message: string, highlight: boolean = false, task_id: string = null) {
    super('warning', highlight, message, task_id);
  }
}

export class ProgressErrorPayload extends ProgressPayload {
  constructor(message: string, highlight: boolean = false, task_id: string = null) {
    super('error', highlight, message, task_id);
  }
}

export class ProgressSSHCmdPayload extends ProgressPayload {
  constructor(message: string, highlight: boolean = false, task_id: string = null) {
    super('ssh_cmd_output', highlight, message, task_id);
  }
}
