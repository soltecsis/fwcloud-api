import { runApplication } from "../../../../utils/utils";
import { AbstractApplication } from "../../../../../src/fonaments/abstract-application";
import { HttpException } from "../../../../../src/fonaments/exceptions/http/http-exception";

let app: AbstractApplication;

beforeAll( async () => {
    app = await runApplication(false);
});
describe('Http exception tests', () => {

    it('stack should not be present in the response if the application is production mode', async() => {
        const spy = jest.spyOn(app.config, 'get').mockImplementation(() => 'prod');

        expect(new HttpException().toResponse()).not.toHaveProperty('error.stack');
    });

    it('stack should be present in the response if the application is not in production mode', async() => {
        let spy = jest.spyOn(app.config, 'get').mockImplementation(() => 'dev');
        expect(new HttpException().toResponse()).toHaveProperty('error.stack');

        spy = jest.spyOn(app.config, 'get').mockImplementation(() => 'test');
        expect(new HttpException().toResponse()).toHaveProperty('error.stack');
    })
});