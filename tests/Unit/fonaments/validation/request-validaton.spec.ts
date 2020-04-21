/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

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

beforeEach(async () => {
    app = testSuite.app;
});

class RequestValidationTest extends RequestValidation {
    public rules(): Joi.JoiObject {
        return Joi.object({
            test: Joi.any().required()
        })
    }
}

describe(describeName('RequestValidation Unit tests'), () => {
    describe('validate()', () => {
        it('should return an exception if a validation rule fails', async () => {
            const iv = new RequestValidationTest({
                inputs: new RequestInputs({} as Request)
            } as Request);

            let t = async () => {
                return await iv.validate();
            }

            await expect(t()).to.eventually.be.rejectedWith(Error);
        });

        it('should not return an exception if all validation rule works', async () => {
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
});