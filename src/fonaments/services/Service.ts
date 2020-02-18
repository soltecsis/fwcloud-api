import { AbstractApplication } from "../AbstractApplication";


export abstract class Service {
    constructor(protected _app: AbstractApplication) { }
}