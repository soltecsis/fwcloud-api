import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import request = require("supertest");
import { _URL } from "../../../src/fonaments/http/router/router.service";
import sinon from "sinon";
import { CORS } from "../../../src/middleware/cors.middleware";
import fwcError from '../../../src/utils/error_table';

let app: Application;
describe(describeName('CORS middleware test'), () => {
    beforeEach(async () => {
        app = testSuite.app;
    });

    it('should return 400 when request is rejected by CORS', async() => {
        let stubDate = sinon.stub(CORS.prototype, 'isOriginAllowed').returns(false);
        

        await request(app.express)
            .post(_URL().getURL('versions.show'))
            .expect(400)
            .expect((response) => {
                expect(response.body.msg).to.be.deep.eq(fwcError.NOT_ALLOWED_CORS.msg)
            });

        stubDate.restore();
    });

    it('should not return 400 when request is allowed by CORS', async() => {
        let stubDate = sinon.stub(CORS.prototype, 'isOriginAllowed').returns(true);
        

        await request(app.express)
            .post(_URL().getURL('versions.show'))
            .expect(401);

        stubDate.restore();
    });
})