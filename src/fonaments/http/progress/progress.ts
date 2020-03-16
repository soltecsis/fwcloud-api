import { EventEmitter } from "typeorm/platform/PlatformTools";

export class Progress<T> {
    protected _response: T;
    protected _eventScope: string
    protected _eventEmitter: EventEmitter;

    constructor(response: T, eventScope: string) {
        this._response = response;
        this._eventScope = eventScope;

        this._eventEmitter = new EventEmitter();
    }

    get response(): T {
        return this._response;
    }

    public emit(event: string, args: object): boolean {
        return this._eventEmitter.emit(this._eventScope + ':' + event, args);
    }

    public on(event: string, listener: (...args: any[]) => void): this {
        this._eventEmitter.on(this._eventScope + ':' + event, listener);
        return this;
    }

}