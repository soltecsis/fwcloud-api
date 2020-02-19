import ObjectHelpers from '../../../src/utils/object-helpers';

describe('ObjectHelpers tests', () => {
    it('merge should merge multiple objects', () => {
        expect(ObjectHelpers.merge({a: 'a'}, {b: 'b'}, {c: 'c'})).toEqual({
            a: 'a',
            b: 'b',
            c: 'c'
        });
    });
});