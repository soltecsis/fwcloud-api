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

import { AbstractApplication } from "../../../../../src/fonaments/abstract-application";
import { HttpException } from "../../../../../src/fonaments/exceptions/http/http-exception";
import { expect, testSuite, describeName } from "../../../../mocha/global-setup";
import { NotFoundException } from "../../../../../src/fonaments/exceptions/not-found-exception";

let app: AbstractApplication;

describe(describeName('HttpException Unit tests'), () => {

    beforeEach(async () => {
        app = testSuite.app;
    });


    describe('toResponse()', () => {
        it('details should not be present in the response if the application is production mode', async () => {
            app.config.set('env', 'prod');

            expect(new HttpException().toResponse().exception).is.undefined;

            app.config.set('env', 'test');
        });

        it('details should be present in the response if the application is not in production mode', async () => {
            app.config.set('env', 'dev');

            expect(new HttpException().toResponse().exception).is.not.undefined;

            app.config.set('env', 'test');
        });

        it('name should be retrieved from the caused_by exception', async () => {
            expect(new HttpException(null, new NotFoundException()).toResponse().exception.name).to.be.deep.eq(HttpException.name);
            expect(new HttpException(null, new NotFoundException()).toResponse().exception.caused_by.name).to.be.deep.eq(NotFoundException.name);
        });
    });
});