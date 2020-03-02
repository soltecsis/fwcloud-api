import { randomString } from "../../../utils/utils";
import { ServiceContainer } from "../../../../src/fonaments/services/service-container"
import { Application } from "../../../../src/Application";
import { Service } from "../../../../src/fonaments/services/service";
import { AbstractApplication } from "../../../../src/fonaments/abstract-application";
import { testSuite, expect, describeName } from "../../../mocha/global-setup";

let app: Application; 
before(async() => {
    app = testSuite.app;
});

class TestService extends Service { 
    public tag: string;
}

describe(describeName('Service container tests'), () => {
    it('bind a service should include a service reference into the services array', async() => {
        const sc = new ServiceContainer(app)

        sc.bind(TestService.name, null);

        expect(sc.services).to.be.deep.equal([
            {
                singleton: false,
                name: 'TestService',
                target: null,
                instance: null
            }
        ])
    });

    it('singleton a service should include a service reference with an instance', async() => {
        const sc = new ServiceContainer(app);
        sc.singleton<TestService>(TestService.name, async (app: AbstractApplication) => {
            return await TestService.make(app)
        });

        expect(await sc.get<TestService>('TestService')).to.be.deep.equal(await TestService.make(app));
    });

    it('get a bound service should return an instance of the service', async() => {
        const sc = new ServiceContainer(app);
        sc.bind(TestService.name, async (app: AbstractApplication) => await TestService.make(app));

        expect(await sc.get(TestService.name)).to.be.deep.equal(await TestService.make(app));
    });

    it('get a singleton service should return the instance of the service', async () => {
        const sc = new ServiceContainer(app);
        
        sc.singleton(TestService.name, async (app: AbstractApplication) => {
            const c: TestService = await TestService.make(app);
            c.tag = randomString(10);
            return c;
        });

        expect((await sc.get<TestService>(TestService.name)).tag).to.be.deep.equal((await sc.get<TestService>(TestService.name)).tag);
    });

    it('get a non singleton service should return a new instance of the service', async () => {
        const sc = new ServiceContainer(app);
        
        sc.bind(TestService.name, async (app: AbstractApplication) => {
            const c: TestService = await TestService.make(app);
            c.tag = randomString(10);
            return c;
        });

        expect((await sc.get<TestService>(TestService.name)).tag).not.be.deep.equal((await sc.get<TestService>(TestService.name)).tag);
    });
});