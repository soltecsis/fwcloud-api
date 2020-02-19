import { Responsable } from "../../contracts/responsable";
import ObjectHelpers from "../../../utils/object-helpers";
import { app, AbstractApplication } from "../../abstract-application";

export class HttpException extends Error implements Responsable {
    
    protected _app: AbstractApplication;

    public info: string;
    public status: number;
    public message: string;
    private _exception: string;

    constructor() {
        super();
        this._app = app();
        this._exception = this.constructor.name;
        this.message = this._exception;
        this.info = this.message;
    }
    
    toResponse(): Object {
        return this.generateResponse();
    }

    protected response(): Object {
        return {}
    }

    private generateResponse(): Object {
        return {
            error: ObjectHelpers.merge({
                status: this.status,
                information: this.info,
                message: this.message,
                exception: this._exception,
            }, this.printStack(), this.response())
        }
    }

    private printStack(): Object {
        const obj: any = {};

        if (this.shouldPrintStack()) {
            obj.stack = this.stack;
        }

        return obj;
    }

    private shouldPrintStack(): boolean {
        return this._app.config.get('env') !== 'prod';
    }
}