import { describeName, expect } from "../../../../../mocha/global-setup";
import { Required } from "../../../../../../src/fonaments/validation/rules/required.rule";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";

describe.only(describeName('Required Rule Unit Test'), () => {
    let rule: Rule = new Required();

    describe('passes()', () => {
        it('should return false if the value is undefined', async () => {
            expect(await rule.passes("input", undefined)).to.be.false;
        });

        it('should return false if the value is null', async () => {
            expect(await rule.passes("input", null)).to.be.false;
        });

        it('should return true if the value is present', async () => {
            expect(await rule.passes("input", "value")).to.be.true;
        })
    })
})