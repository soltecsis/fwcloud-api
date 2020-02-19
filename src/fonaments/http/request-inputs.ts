import { Request } from "express";
import ObjectHelpers from "../../utils/object-helpers";

export class RequestInputs {

    private _req: Request;

    private _inputs: Object;

    constructor(req: Request) {
        this._req = req;
        this._inputs = {};
        this.bindRequestInputs();
    }

    /**
     * Returns all inputs
     */
    public all(): Object {
        return this._inputs;
    }

    /**
     * Returns the input value or default value if it does not exist
     * 
     * @param name Input name
     * @param defaultValue Default value
     */
    public get(name: string, defaultValue: any = undefined): any {
        return this._inputs[name] ? this._inputs[name] : defaultValue;
    }

    /**
     * Returns whether an input exists
     * 
     * @param name Input name
     */
    public has(name: string): boolean {
        return this._inputs.hasOwnProperty(name);
    }

    private bindRequestInputs() {
        this._inputs = ObjectHelpers.merge(this._req.body, this._req.query);
    }
}