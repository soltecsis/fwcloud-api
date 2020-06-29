import { Rule } from "./rule";
import { object } from "joi";
import { Required } from "./required.rule";

export class RequiredIf extends Rule {
    protected _input: string;

    constructor(input: string) {
        super();
        this._input = input;
    }

    public async passes(attribute: string, value: any): Promise<boolean> {
        if (Object.prototype.hasOwnProperty.call(this._data, this._input)) {
            return await new Required().passes(attribute, value);
        }

        return true;
    }
    public message(attribute: string, value: any): string {
        return `${attribute} is required if ${this._input} is present`;
    }

}