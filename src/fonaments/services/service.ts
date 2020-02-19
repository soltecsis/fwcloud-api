import { AbstractApplication } from "../abstract-application";


export abstract class Service {
    constructor(protected _app: AbstractApplication) { }
}