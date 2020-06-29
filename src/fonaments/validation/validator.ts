import { Rule } from "./rules/rule";
import { ErrorBag } from "./error-bag";

export type InputRules = Array<Rule>;
export type RequestRules = {[input: string]: InputRules};

export class Validator {

    protected _data: object;
    protected _failedRules: RequestRules;
    protected _rules: RequestRules;

    protected _errors: ErrorBag;

    constructor(data: object, rules: RequestRules) {
        this._data = data;
        this._failedRules = {};
        this._rules = rules;
    }

    get errors(): ErrorBag {
        return this._errors;
    }

    /*public async validate(): Promise<void> {

    }*/

    public async isValid(): Promise<boolean> {
        let isValid: boolean = true;
        this._errors = new ErrorBag();

        for(let attribute in this._rules) {
            
            for(let i = 0; i < this._rules[attribute].length; i++) {
                // Give the context to the rule
                this._rules[attribute][i].context(this._data);
                const result: boolean = await this._rules[attribute][i].passes(attribute, this._data[attribute])
                
                if (!result) {
                    isValid = false;
                    this._errors.add(attribute, this._rules[attribute][i].message(attribute, this._data[attribute]));
                }
            }
        }

        return isValid;
    }
}