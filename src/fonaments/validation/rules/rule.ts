export abstract class Rule {
    
    protected _data: object;

    constructor() {
        this._data = {};
    }

    public context(data: object) {
        this._data = data;
    }

    public abstract async passes(attribute: string, value: any): Promise<boolean>;
    public abstract message(attribute: string, value: any): string;

}