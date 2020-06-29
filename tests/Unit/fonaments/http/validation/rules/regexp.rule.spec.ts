import { describeName, expect } from "../../../../../mocha/global-setup";
import { Required } from "../../../../../../src/fonaments/validation/rules/required.rule";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";
import { Regexp } from "../../../../../../src/fonaments/validation/rules/regexp.rule";

describe.only(describeName('Regexp Rule Unit Test'), () => {
    let rule: Rule = new Regexp(/[a-zA-Z]+/);

    describe('passes()', () => {
        it('should return false if the value does not match the regexp', async () => {
            expect(await rule.passes("input", 1)).to.be.false;
        });

        it('should return true if the value matches the regexp', async () => {
            expect(await rule.passes("input", "value")).to.be.true;
        });
    })
})