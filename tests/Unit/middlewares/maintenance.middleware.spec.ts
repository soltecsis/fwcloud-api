import { describeName, testSuite } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import request = require("supertest");
import { _URL } from "../../../src/fonaments/http/router/router.service";

let app: Application;

describe(describeName('Maintenance middleware test'), () => {
    beforeEach(async () => {
        app = testSuite.app;
    });

    it('should return 503 if the application is in maintenance mode', async() => {
        app.config.set('maintenance_mode', true);

        await request(app.express)
            .post(_URL().getURL('versions.show'))
            .expect(503)
    });
})