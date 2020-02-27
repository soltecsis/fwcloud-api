import { AbstractApplication } from "../../../../../src/fonaments/abstract-application";
import { HttpException } from "../../../../../src/fonaments/exceptions/http/http-exception";
import { expect, testSuite, describeName } from "../../../../mocha/global-setup";

let app: AbstractApplication;

before( async () => {
    app = testSuite.app;
});

describe(describeName('Http exception tests'), () => {

    it.skip('stack should not be present in the response if the application is production mode', async() => {
        /*const spy = mocha.spyOn(app.config, 'get').mockImplementation(() => 'prod');

        expect(new HttpException().toResponse()).not.toHaveProperty('error.stack');*/
    });

    it.skip('stack should be present in the response if the application is not in production mode', async() => {
        /*let spy = jest.spyOn(app.config, 'get').mockImplementation(() => 'dev');
        expect(new HttpException().toResponse()).toHaveProperty('error.stack');

        spy = jest.spyOn(app.config, 'get').mockImplementation(() => 'test');
        expect(new HttpException().toResponse()).toHaveProperty('error.stack');*/
    })
});