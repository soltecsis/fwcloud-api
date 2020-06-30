import { describeName, expect } from "../../../../../mocha/global-setup";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";
import { String } from "../../../../../../src/fonaments/validation/rules/string.rule";

describe(describeName('String Rule Unit Test'), () => {
    let rule: Rule = new String();

    describe('passes()', () => {
        it('should return false if the value is not string', async () => {
            expect(await rule.passes("input", 1)).to.be.false;
        });

        it('should return true if the value is string', async () => {
            expect(await rule.passes("input", "1")).to.be.true;
        });

        it('should return true if the value is undefined', async () => {
            expect(await rule.passes("input", undefined)).to.be.true;
        })
    });
})