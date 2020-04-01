import { EventEmitter } from "typeorm/platform/PlatformTools";
import { ProgressState } from "./progress-state";

export type progressEventName = 'start' | 'step' | 'event' | 'end';

export class Progress<T> {
    protected _response: T;
    protected _eventEmitter: EventEmitter;

    protected _state: ProgressState;

    constructor(steps: number) {
        this._state = new ProgressState(steps);
        this._eventEmitter = new EventEmitter();
    }

    get response(): T {
        return this._response;
    }

    set response(response: T) {
        this._response = response;
    }

    public start(message: string, status: number = 102): boolean {
        return this.emit('start', this._state.incrementStep(status, message));
    }

    public event(message: string): boolean {
        return this.emit('event', this._state.setMessage(message));
    }

    public step(message: string, status: number = 102): boolean {
        return this.emit('step', this._state.incrementStep(status, message));
    }

    public end(message: string, status: number = null, ...args: object[] ): boolean {
        status = status ? status: 200;
        return this.emit('end', this._state.incrementStep(status, message), args);
    }

    public emit(event: progressEventName, progressEvent: ProgressState, ... args: object[]): boolean {
        return this._eventEmitter.emit(event, progressEvent, args);
    }

    public on(event: progressEventName, listener: (...args: any[]) => void): this {
        this._eventEmitter.on(event, listener);
        return this;
    }

}