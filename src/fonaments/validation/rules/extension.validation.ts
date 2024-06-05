import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { FileInfo } from '../../http/files/file-info';

@ValidatorConstraint({ async: false })
export class HasExtension implements ValidatorConstraintInterface {
  validate(
    value: any,
    validationArguments?: ValidationArguments,
  ): boolean | Promise<boolean> {
    if (
      value === undefined ||
      value === null ||
      value instanceof FileInfo === false
    ) {
      return true;
    }

    return value.filepath.endsWith(`.${validationArguments.constraints[0]}`);
  }

  defaultMessage?(validationArguments?: ValidationArguments): string {
    return `${validationArguments.property} extension not valid.`;
  }
}
