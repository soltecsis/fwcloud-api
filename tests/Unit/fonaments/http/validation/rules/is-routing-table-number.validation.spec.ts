import { IsRoutingTableNumberConstraint } from "../../../../../../src/fonaments/validation/rules/is-routing-table-number.validation";
import { describeName, expect } from "../../../../../mocha/global-setup";

describe(describeName(IsRoutingTableNumberConstraint.name + ' Unit Tests'), () => {
    let constraint: IsRoutingTableNumberConstraint;

    beforeEach(() => {
        constraint = new IsRoutingTableNumberConstraint(); 
    });

    describe('passes()', () => {
        it('should return true if number is 254', async () => {
            expect(constraint.validate(254)).to.be.true;
        });

        it('should return true if number is between 1 and 250', async () => {
            expect(constraint.validate(1)).to.be.true;
            expect(constraint.validate(250)).to.be.true;
            expect(constraint.validate(150)).to.be.true;
        });

        it('should return false if number is lower than 1', async () => {
            expect(constraint.validate(0)).to.be.false;
            expect(constraint.validate(-1)).to.be.false;
        });

        it('should return false if number is greater than 250', async () => {
            expect(constraint.validate(251)).to.be.false;
            expect(constraint.validate(253)).to.be.false;
            expect(constraint.validate(255)).to.be.false;
        });
    })
})