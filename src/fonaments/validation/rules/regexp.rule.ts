import { Rule } from "./rule";

export class Regexp extends Rule {
    
    protected _regexp: RegExp;

    constructor(regexp: RegExp) {
        super();
        this._regexp = regexp;
    }
    
    public async passes(attribute: string, value: any): Promise<boolean> {
        return this._regexp.test(value);
    }

    public message(attribute: string, value: any): string {
        return `${attribute} is not valid.`;
    }

}