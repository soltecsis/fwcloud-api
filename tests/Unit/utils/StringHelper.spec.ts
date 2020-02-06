import StringHelper from '../../../src/utils/StringHelper';

describe('StringHelper tests', () => {
    it('toCamelCase should return empty string if only an empty string is provided', () => {
        expect(StringHelper.toCamelCase("")).toBe("");
    });

    it('toCamelCase should return the same word if only one word is provided', () => {
        expect(StringHelper.toCamelCase("test")).toBe("test");
    });

    it('toCamelCase should return camelcased word', () => {
        expect(StringHelper.toCamelCase("test", "test")).toBe("testTest");
    })

    it('capitalize should return capitalized word', () => {
        expect(StringHelper.capitalize("test")).toBe('Test');
    });
});