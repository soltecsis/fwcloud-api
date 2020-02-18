import { AbstractApplication } from "../AbstractApplication";

export class Controller {
    constructor(protected _app: AbstractApplication) { }

    public static methodExists(method: string): boolean {
        return typeof this[method] === 'function' || typeof this.prototype[method] === 'function';
    }
}