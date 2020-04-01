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

import { describeName, expect } from "../../../../mocha/global-setup";
import { Route } from "../../../../../src/fonaments/http/router/route";
import { ParamNotValidException } from "../../../../../src/fonaments/http/router/exceptions/param-not-valid.exception";
import { ParamMissingException } from "../../../../../src/fonaments/http/router/exceptions/param-missing.exception";

describe(describeName('Route tests'), () => {
    it('generateURL should generate the a simple URL', () => {
        const route = new Route();
        route.setPathParams('/this/is/a/test/path');

        expect(route.generateURL()).to.be.deep.eq('/this/is/a/test/path');
    });

    it('generateURL should generate the URL matching params', () => {
        const route = new Route();
        route.setPathParams('/this/:is/a/test/path');

        expect(route.generateURL({is: 'isnot'})).to.be.deep.eq('/this/isnot/a/test/path');
    });

    it('generateURL should not accept params with slashes', () => {
        const route = new Route();
        route.setPathParams('/this/:is/a/test/path');

        function t() {
            route.generateURL({is: '/isnot'})
        }
        
        expect(t).to.throw(ParamNotValidException);
    });

    it('generateURL should throw an exception if not all params are provided', () => {
        const route = new Route();
        route.setPathParams('/this/:is/:a/test/path');

        function t() {
            route.generateURL({is: 'isnot'})
        }
        
        expect(t).to.throw(ParamMissingException);
    });

    it('generaeteURL should remove any parenthesis', () => {
        const route = new Route();
        route.setPathParams('/this/:is/test/path(\\d+)');

        expect(route.generateURL({is: 'isnot'})).to.be.deep.eq('/this/isnot/test/path');
    });

    it('generateURL should remove multiple parenthesis', () => {
        const route = new Route();
        route.setPathParams('/this/:is(\\d+)/test/:path(\\d+)');

        expect(route.generateURL({is: 'isnot', path: 'notpath'})).to.be.deep.eq('/this/isnot/test/notpath');    
    })
});