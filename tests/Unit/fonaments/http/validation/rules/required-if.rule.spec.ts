import { describeName, expect } from "../../../../../mocha/global-setup";
import { RequiredIf } from "../../../../../../src/fonaments/validation/rules/required-if.rule";
import { Rule } from "../../../../../../src/fonaments/validation/rules/rule";

describe.only(describeName('Required-If Rule Unit Test'), () => {
    let rule: Rule;
    
    beforeEach(() => {
        rule = new RequiredIf("other");
    });

    describe('passes()', () => {
        it('should return false if it is undefined and the referenced input is present', async () => {
            rule.context({
                "other": "value"
            });
            
            expect(await rule.passes("input", undefined)).to.be.false;
        });

        it('should return false if it is null and the referenced input is present', async () => {
            rule.context({
                "other": "value"
            });
            
            expect(await rule.passes("input", null)).to.be.false;
        });

        it('should return true if it is undefined and the referenced input is not present', async () => {
            expect(await rule.passes("input", undefined)).to.be.true;
        });

        it('should return true if it is null and the referenced input is not present', async () => {
            expect(await rule.passes("input", null)).to.be.true;
        });

        it('should return true if it has a value and the referenced input is present', async () => {
            rule.context({
                "other": "value"
            });
            
            expect(await rule.passes("input", "value")).to.be.true;
        })
    })
});