import { AbstractApplication } from "../../../../../src/fonaments/abstract-application";
import { HttpException } from "../../../../../src/fonaments/exceptions/http/http-exception";
import { expect, testSuite, describeName } from "../../../../mocha/global-setup";
import { NotFoundException } from "../../../../../src/fonaments/exceptions/not-found-exception";

let app: AbstractApplication;

describe(describeName('Http exception tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;
    });


    it('exception details should not be present in the response if the application is production mode', async() => {
        app.config.set('env', 'prod');

        expect(new HttpException().toResponse().exception).is.undefined;

        app.config.set('env', 'test');
    });

    it('exception details should be present in the response if the application is not in production mode', async() => {
        app.config.set('env', 'dev');

        expect(new HttpException().toResponse().exception).is.not.undefined;

        app.config.set('env', 'test');
    });

    it('exception name should be retrieve from the caused_by exception', async () => {
        expect(new HttpException(null, new NotFoundException()).toResponse().exception.name).to.be.deep.eq(HttpException.name);
        expect(new HttpException(null, new NotFoundException()).toResponse().exception.caused_by.name).to.be.deep.eq(NotFoundException.name);
    })
});