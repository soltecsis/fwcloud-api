import { describeName, testSuite, expect } from "../../../../mocha/global-setup";
import { Controller } from "../../../../../src/fonaments/http/controller";
import { RouteCollection } from "../../../../../src/fonaments/http/router/route-collection";
import { RouterParser } from "../../../../../src/fonaments/http/router/router-parser";
import { RouterService } from "../../../../../src/fonaments/http/router/router.service";
import { Route } from "../../../../../src/fonaments/http/router/route";
import { URLHelper } from "../../../../../src/fonaments/http/router/url-helper";


class TestController extends Controller {
    public async test(request: Request) {}
}

class RouteDefinitionTest extends RouteCollection {
    public routes(router: RouterParser): void {
        router.prefix('/test', (router) => {
            router.get('/get', TestController, 'test').name('test.show');
        });
    }

}

let service: RouterService;
let routeGet: Route
let routing: URLHelper;

describe(describeName('URL tests'), () => {
    beforeEach(async() => {
        service = await RouterService.make(testSuite.app);
        service.registerRoutes(RouteDefinitionTest);

        routeGet = new Route();
        routeGet.setControllerHandler({controller: TestController, method: 'test'})
            .setHttpMethod('GET')
            .setName('test.show')
            .setPathParams('/test/get');

        routing = new URLHelper(service);
    });


    it('getRouteByName should return a route by its name', async() => {
        expect(routing.getURL('test.show')).to.be.deep.eq('/test/get');
    });
});