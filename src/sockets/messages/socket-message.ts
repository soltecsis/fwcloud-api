import moment from "moment";
import * as uuid from "uuid";

export class SocketMessage {
    id: string;
    timestamp: number;
    channel: string;
    payload: object
    
    constructor(payload: SocketMessagePayload | object, channel: string = null) {
        this.id = uuid.v1();
        this.timestamp = moment().valueOf();
        this.channel = channel;
        this.payload = payload;
    }
}

export class SocketMessagePayload {}

export type StatusType = 'start' | 'end' | 'start_task' | 'end_task' | 'info' | 'debug' | 'notice' | 'error';

export class ProgressPayload extends SocketMessagePayload {
    readonly task_id?: string;
    readonly type: StatusType;
    readonly message: string;
    readonly data: {[property: string]: any};

    constructor(type: StatusType, message: string, data: {[property: string]: any} = null, task_id: string = null) {
        super();
        this.type = type;
        this.message = message;
        this.data = data;
        this.task_id = task_id;
    }
}

export class ProgressNoticePayload extends ProgressPayload {
    constructor(message: string, data: {[property: string]: any} = null, task_id: string = null) {
        super('notice', message, data, task_id);
    }
}

export class ProgressInfoPayload extends ProgressPayload {
    constructor(message: string, data: {[property: string]: any} = null, task_id: string = null) {
        super('info', message, data, task_id);
    }
}

export class ProgressDebugPayload extends ProgressPayload {
    constructor(message: string, data: {[property: string]: any} = null, task_id: string = null) {
        super('debug', message, data, task_id);
    }
}

export class ProgressErrorPayload extends ProgressPayload {
    constructor(message: string, data: {[property: string]: any} = null, task_id: string = null) {
        super('error', message, data, task_id);
    }
}