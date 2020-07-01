import { Rule } from "./rules/rule";
import { ErrorBag } from "./error-bag";
import { ValidationException } from "../exceptions/validation-exception";

export type InputRules = Array<Rule>;
export type RequestRules = {[input: string]: InputRules};
export type ValidatorOptions = {
    strict: boolean
}

export class Validator {

    protected _data: object;
    protected _failedRules: RequestRules;
    protected _rules: RequestRules;
    protected _options: ValidatorOptions;

    protected _errors: ErrorBag;

    constructor(data: object, rules: RequestRules, opts: ValidatorOptions = {
        strict: true
    }) {
        this._data = data;
        this._failedRules = {};
        this._rules = rules;
        this._options = opts;
    }

    get errors(): ErrorBag {
        return this._errors;
    }

    public async validate(): Promise<void> {
        let isValid: boolean = true;
        this._errors = new ErrorBag();

        for(let attribute in this._data) {
            if (!Object.prototype.hasOwnProperty.call(this._rules, attribute) && this._options.strict) {
                isValid = false;
                this._errors.add(attribute, `${attribute} unexpected.`)
            
            }
        }

        for(let attribute in this._rules) {
            for(let i = 0; i < this._rules[attribute].length; i++) {
                const rule: Rule = this._rules[attribute][i];
                rule.context(this._data);
                const result: boolean = await rule.passes(attribute, this._data[attribute])
            
                if (!result) {
                    isValid = false;
                    this._errors.add(attribute, rule.message(attribute, this._data[attribute]));
                }
            }
        }
        
        if (!isValid) {
            throw new ValidationException('The given data is invalid.', this._errors)
        }
    }

    public async isValid(): Promise<boolean> {
        try {
            await this.validate();
        } catch (e) {
            return false;
        }
        
        return true;
    }
}