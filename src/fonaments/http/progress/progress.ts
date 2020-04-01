import { EventEmitter } from "typeorm/platform/PlatformTools";
import { ProgressState } from "./progress-state";
import { SequencedTask } from "./sequenced-task";
import { GroupDescription } from "./task";

export type progressEventName = 'start' | 'step' | 'event' | 'end';

export class Progress<T> {
    protected _response: T;
    protected _externalEvents: EventEmitter;
    protected _internalEvents: EventEmitter;

    protected _state: ProgressState;

    constructor(response: T) {
        this._response = response;
        this._externalEvents = new EventEmitter();
        this._internalEvents = new EventEmitter();
    }

    get response(): T {
        return this._response;
    }

    set response(response: T) {
        this._response = response;
    }

    public procedure(startText: string, procedure: GroupDescription, finishedText: string = null): void {
        const task = new SequencedTask(this._internalEvents, procedure, finishedText);
        this._state = new ProgressState(task.getSteps() + 1, 0, 102, startText);
        
        this._internalEvents.on('step', (message: string) => {
            this._externalEvents.emit('step', this._state.updateState(message, 102, true));
        });

        this._internalEvents.on('event', (message: string) => {
            this._externalEvents.emit('event', this._state.updateState(message, 102, false));
        });

        this._externalEvents.emit('start', this._state);
        task.run().then(() => {
            this._externalEvents.emit('end', this._state.updateState(finishedText, 200, true));
        });
    }

    public on(event: progressEventName, listener: (...args: any[]) => void): this {
        this._externalEvents.on(event, listener);
        return this;
    }

}