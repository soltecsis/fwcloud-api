import { describeName, expect } from "../../../../../mocha/global-setup";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";
import { Number } from "../../../../../../src/fonaments/validation/rules/number.rule";

describe(describeName('Number Rule Unit Test'), () => {
    let rule: Rule = new Number();

    describe('passes()', () => {
        it('should return false if the value is not a number', async () => {
            expect(await rule.passes("input", "other")).to.be.false;
        });

        it('should return false if the value is a number', async () => {
            expect(await rule.passes("input", 4)).to.be.true;
        });
    })
})