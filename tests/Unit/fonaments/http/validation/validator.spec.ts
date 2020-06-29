import { describeName, expect } from "../../../../mocha/global-setup";
import { Validator } from "../../../../../src/fonaments/validation/validator";
import { Rule } from "../../../../../src/fonaments/validation/rules/rule";
import { ErrorBag } from "../../../../../src/fonaments/validation/error-bag";

class ValidRule extends Rule {
    public async passes(attribute: string, value: any): Promise<boolean> {
        return true;
    }
    public message(attribute: string, value: any): string {
        throw new Error("Method not implemented.");
    }
}

class InvalidRule extends Rule {
    public async passes(attribute: string, value: any): Promise<boolean> {
        return false;
    }
    
    public message(attribute: string, value: any): string {
        return `${attribute} is invalid.`
    }
    
}

describe.only(describeName('Validator Unit Test'), () => {
    describe('isValid()', () => {
        it('should return false if a rule is not valid', async () => {
            const validator: Validator = new Validator({"input": "value"}, {
                "input": [new InvalidRule()]
            })

            expect(await validator.isValid()).to.be.false;
        });

        it('should return true if a rule is valid', async() => {
            const validator: Validator = new Validator({"input": "value"}, {
                "input": [new ValidRule()]
            })

            expect(await validator.isValid()).to.be.true;
        });

        it('should return false if at least one rule is not valid', async () => {
            const validator: Validator = new Validator({"input": "value"}, {
                "input": [new ValidRule(), new InvalidRule()]
            })

            expect(await validator.isValid()).to.be.false;
        });

        it('should create an error bag with the error messages', async () => {
            const validator: Validator = new Validator({"input": "value"}, {
                "input": [new ValidRule(), new InvalidRule()]
            })

            expect(await validator.isValid()).to.be.false;
            expect(validator.errors).to.be.instanceOf(ErrorBag);
            expect(validator.errors.get("input")).to.be.deep.eq([
                "input is invalid."
            ])
        })
    });
});