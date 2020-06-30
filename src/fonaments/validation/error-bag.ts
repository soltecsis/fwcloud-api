export class ErrorBag {
    protected _errors: {[input: string]: Array<string>}

    constructor() {
        this._errors = {};
    }

    /**
     * Adds a new input error message
     * 
     * @param input Input name
     * @param error Error message
     */
    public add(input: string, error: string) {
        if (!Object.prototype.hasOwnProperty.call(this._errors, input)) {
            this._errors[input] = [];
        }

        this._errors[input].push(error);
    }

    public get(input: string): Array<string> {
        if (Object.prototype.hasOwnProperty.call(this._errors, input)) {
            return this._errors[input];
        }

        return [];
    }

    public all(): {[input: string]: Array<string>} {
        return this._errors;
    }
}