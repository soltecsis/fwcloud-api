export interface Input {
    name: string;
    value: any;
}

export class Request {

    _req: Express.Request;
    
    _inputs: Array<{name: string, value: any}> = [];

    constructor(req: any) {
        this._req = req;
        this.addInputs(req.body || {});
        this.addInputs(req.params || {});
    }

    /**
     * Add a new input object into the request input array
     * 
     * @param input Input object
     */
    public addInputs(input: {}): void {
        this.mergeInputArray(this.parseInputs(input));
    }

    /**
     * Returns all inputs
     */
    public getInputs(): Array<{name: string, value: any}> {
        return this._inputs
    }

    /**
     * Returns the input value or default value if it does not exist
     * 
     * @param name Input name
     * @param defaultValue Default value
     */
    public input(name: string, defaultValue: any = null): any {
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
    public hasInput(name: string): boolean {
        return this.filterByInputName(name).length > 0;
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
            if (!this.hasInput(item.name)) {
                this._inputs.push(item);
            }
        })
    }
}