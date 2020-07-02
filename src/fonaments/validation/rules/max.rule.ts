import { Rule } from "./rule";
import { isNumber } from "util";

export class Max extends Rule {

    protected _max: number;

    constructor(max: number) {
        super();
        this._max = max;
    }
    
    public async passes(attribute: string, value: any): Promise<boolean> {
        if (value === undefined) {
            return true;
        }

        if (typeof value === 'string') {
            return value.length <= this._max;
        }

        if (typeof value === 'number') {
            return value <= this._max;
        }

        return false;
    }
    
    public message(attribute: string, value: any): string {
        if (typeof value === 'string') {
            return `${attribute} is too long.`
        }

        return `${attribute} is not valid.`
    }

}