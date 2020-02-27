import '../../mocha/global-setup';
import { expect, describeName } from "../../mocha/global-setup";

import ObjectHelpers from '../../../src/utils/object-helpers';

describe(describeName('ObjectHelpers tests'), () => {
    it('merge should merge multiple objects', () => {
        expect(ObjectHelpers.merge({a: 'a'}, {b: 'b'}, {c: 'c'})).to.be.deep.equal({
            a: 'a',
            b: 'b',
            c: 'c'
        });
    });
});