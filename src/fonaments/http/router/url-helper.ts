import { RouterService } from "./router.service";
import { Route } from "./route";

export class URLHelper {
    constructor(protected _routerService: RouterService) {}

    public getURL(routeName: string, params?: object): string {
        const route: Route = this._routerService.findRouteByName(routeName);

        if (route === null) {
            throw Error('Route ' + routeName + ' not found');
        }

        return route.generateURL(params);
    }
}