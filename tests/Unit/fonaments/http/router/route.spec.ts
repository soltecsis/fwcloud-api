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