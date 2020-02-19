import { RouterService } from "./router.service";
import { AbstractApplication } from "../../abstract-application";

export abstract class RouteCollection {

    constructor(protected _app: AbstractApplication, protected _router: RouterService) {
        this.routes(this._router);
    }
    
    public abstract routes(router: RouterService): void;
}