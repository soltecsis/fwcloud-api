import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";

@ValidatorConstraint({ async: true })
export class IsRoutingTableNumberConstraint implements ValidatorConstraintInterface {
  validate(number: number) {
    return number === 254 || (number > 0 && number <= 250);
  }
}

export function IsRoutingTableNumber(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isRoutingTableNumber',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: IsRoutingTableNumberConstraint,
    });
  };
}