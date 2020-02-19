import { Request } from "express";
import { RequestValidation } from "../../../../src/fonaments/validation/request-validation";
import { runApplication } from '../../../utils/utils';
import { RequestInputs } from "../../../../src/fonaments/http/request-inputs";
import * as Joi from "joi";

beforeAll(async() => {
    await runApplication(false);
});
class RequestValidationTest extends RequestValidation {
    public rules(): Joi.JoiObject {
        return Joi.object({
            test: Joi.any().required()
        })
    }
}

describe('Request tests', () => {
    it('should return an exception if a validation rule fails', async() => {
        const iv = new RequestValidationTest({
            inputs: new RequestInputs({} as Request)
        } as Request);

        let t = async () => {
            return await iv.validate();
        }

        return expect(t()).rejects.toThrow();
    });

    it('should not return an exception if all validation rule works', async() => {
        const iv = new RequestValidationTest({
            inputs: new RequestInputs({
                body: {
                    test: 'test'
                }
            } as Request)
        } as Request);

        return expect(iv.validate()).resolves.not.toThrowError();
    });
});