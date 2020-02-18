import { RouterService } from "./RouterService";
import { AbstractApplication } from "../../AbstractApplication";

export abstract class RouteCollection {

    constructor(protected _app: AbstractApplication, protected _router: RouterService) {
        this.routes(this._router);
    }
    
    public abstract routes(router: RouterService): void;
}