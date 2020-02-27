import '../../../mocha/global-setup';
import { describeName, expect } from "../../../mocha/global-setup";

import { Request } from "express";
import { RequestValidation } from "../../../../src/fonaments/validation/request-validation";
import { RequestInputs } from "../../../../src/fonaments/http/request-inputs";
import * as Joi from "joi";
import { Application } from "../../../../src/Application";
import { testSuite } from "../../../mocha/global-setup";
import { ValidationException } from '../../../../src/fonaments/exceptions/validation-exception';


let app: Application; 

beforeEach(async() => {
    app = testSuite.app;
});

class RequestValidationTest extends RequestValidation {
    public rules(): Joi.JoiObject {
        return Joi.object({
            test: Joi.any().required()
        })
    }
}

describe(describeName('Request tests'), () => {
    it('should return an exception if a validation rule fails', async() => {
        const iv = new RequestValidationTest({
            inputs: new RequestInputs({} as Request)
        } as Request);

        let t = async () => {
            return await iv.validate();
        }

        await expect(t()).to.eventually.be.rejectedWith(Error);
    });

    it('should not return an exception if all validation rule works', async() => {
        const iv = new RequestValidationTest({
            inputs: new RequestInputs({
                body: {
                    test: 'test'
                }
            } as Request)
        } as Request);

        iv.validate().should.not.be.rejected;
    });
});