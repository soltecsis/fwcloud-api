import { Request } from "express";

export interface Input {
    name: string;
    value: any;
}
export class RequestInputs {

    private _req: Request;

    private _inputs: Array<{name: string, value: any}> = [];

    constructor(req: Request) {
        this._req = req;
    }

    /**
     * Returns all inputs
     */
    public getInputs(): Array<{name: string, value: any}> {
        this.bindRequestInputs();
        return this._inputs
    }

    /**
     * Returns the input value or default value if it does not exist
     * 
     * @param name Input name
     * @param defaultValue Default value
     */
    public get(name: string, defaultValue: any = null): any {
        this.bindRequestInputs();
        const input: Array<Input> = this.filterByInputName(name);

        if(input.length === 1) {
            return input[0].value;
        }

        if (input.length === 0) {
            return defaultValue;
        }

        return null;
    }

    /**
     * Returns whether an input exists
     * 
     * @param name Input name
     */
    public has(name: string): boolean {
        this.bindRequestInputs();
        return this.filterByInputName(name).length > 0;
    }

    private bindRequestInputs() {
        this._inputs = [];
        this.mergeInputArray(this.parseInputs(this._req.body || {}));
        this.mergeInputArray(this.parseInputs(this._req.params || {}));
    }

    /**
     * Returns the input which name is the name provided
     * 
     * @param name Input name
     */
    private filterByInputName(name: string): Array<Input> {
        return this._inputs.filter((item: Input) => item.name === name);
    }

    /**
     * Transform and input object into an input array
     * 
     * @param inputs Input object
     */
    private parseInputs(inputs: {} = {}): Array<any> {
        const result: Array<any> = [];

        for(let key in inputs) {
            result.push({
                name: key, 
                value: inputs[key]
            });
        }
        
        return result;
    }

    /**
     * Merge an array input into the request inputs
     * 
     * @param inputs Input array
     */
    private mergeInputArray(inputs: Array<Input>): void {
        inputs.forEach((item: Input) => {
            if (this.filterByInputName(item.name).length === 0) {
                this._inputs.push(item);
            }
        })
    }
}