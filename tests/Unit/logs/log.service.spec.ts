import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { LogService } from "../../../src/logs/log.service";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";

describe.only(describeName('LogService Unit Tests'), () => {
    let app: AbstractApplication;
    let service: LogService;

    beforeEach(async() => {
        app = testSuite.app;
        service = await app.getService<LogService>(LogService.name);
    });

    it('should be provided as a service', async () => {
        expect(await app.getService<LogService>(LogService.name)).to.be.instanceOf(LogService);
    });
});