import { ExceptionResponse } from "../http/response-builder";
import { AbstractApplication, app } from "../abstract-application";

export class FwCloudError extends Error {
    protected _caused_by: FwCloudError;
    protected _app: AbstractApplication;

    constructor(message: string = null, caused_by: FwCloudError = null) {
        super(message ? message : "");
        this.name = this.constructor.name;
        this._app = app();
        this._caused_by = caused_by;
    }

    public fromError(error: Error): FwCloudError {
        this.stack = error.stack;
        this.message = error.message;
        this.name = error.name;

        return this;
    }
    
    public getExceptionDetails(): ExceptionResponse {
        const result: Partial<ExceptionResponse> = {
            name: this.constructor.name,
            stack: this.stackToArray()
        }

        if (this._caused_by) {
            result.caused_by = this._caused_by.getExceptionDetails();
        }

        return <ExceptionResponse>result;
    }

    protected stackToArray(): Array<string> {
        const stack: string = this.stack;
        const results: Array<string> = [];
        const stackLines: Array<string> = stack.split("\n");

        for(let i = 0; i < stackLines.length; i++ ) {
            const line: string = stackLines[i].trim();
            results.push(line);
        }

        return results;
    }
}