import { describeName, expect } from "../../../../../mocha/global-setup";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";
import { Max } from "../../../../../../src/fonaments/validation/rules/max.rule";

describe(describeName('Max Rule Unit Test'), () => {
    let rule: Rule = new Max(3);

    describe('passes()', () => {
        it('should return false if the value is a string but its length is too long', async () => {
            expect(await rule.passes("input", "other")).to.be.false;
        });

        it('should return false if the value is a number and its value is greater', async () => {
            expect(await rule.passes("input", 4)).to.be.false;
        })

        it('should return true if the value is undefined', async () => {
            expect(await rule.passes("input", undefined)).to.be.true;
        });

        it('should return true if the value is string and its lengh does not reach the limit', async () => {
            expect(await rule.passes("input", "oth")).to.be.true;
        });

        it('should return true if the value is number and its lower or equal than the limit', async () => {
            expect(await rule.passes("input", 3)).to.be.true;
            expect(await rule.passes("input", 2)).to.be.true;
        })
    })
})