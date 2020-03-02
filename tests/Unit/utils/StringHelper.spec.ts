import StringHelper from '../../../src/utils/StringHelper';
import { expect, describeName } from '../../mocha/global-setup';

describe(describeName('StringHelper tests'), () => {
    it('toCamelCase should return empty string if only an empty string is provided', () => {
        expect(StringHelper.toCamelCase("")).to.be.deep.equal("");
    });

    it('toCamelCase should return the same word if only one word is provided', () => {
        expect(StringHelper.toCamelCase("test")).to.be.deep.equal("test");
    });

    it('toCamelCase should return camelcased word', () => {
        expect(StringHelper.toCamelCase("test", "test")).to.be.deep.equal("testTest");
    })

    it('capitalize should return capitalized word', () => {
        expect(StringHelper.capitalize("test")).to.be.deep.equal('Test');
    });
});