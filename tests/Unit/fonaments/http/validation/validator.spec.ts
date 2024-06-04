import { describeName, expect } from "../../../../mocha/global-setup";
import { Validator } from "../../../../../src/fonaments/validation/validator";
import { IsNumber, IsString } from "class-validator";
import { ValidationException } from "../../../../../src/fonaments/exceptions/validation-exception";

describe(describeName("Validator Unit Test"), () => {
  class ValidDto {
    @IsString()
    input: string;
  }

  class InvalidDto {
    @IsNumber()
    input: number;
  }

  describe("validate()", () => {
    it("should throw an exception if validation fails", async () => {
      const validator: Validator = new Validator(
        { input: "value" },
        InvalidDto,
      );

      try {
        await validator.validate();
      } catch (e) {
        expect(e).to.be.instanceOf(ValidationException);
      }
    });

    it("should not throw an exception if the data is valid", async () => {
      const validator: Validator = new Validator({ input: "value" }, ValidDto);

      expect(await validator.validate()).to.be.undefined;
    });
  });
});
