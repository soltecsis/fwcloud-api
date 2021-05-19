import { ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { FileInfo } from "../../http/files/file-info";

@ValidatorConstraint({async: false})
export class IsFile implements ValidatorConstraintInterface {
    
    validate(value: any, validationArguments?: ValidationArguments): boolean | Promise<boolean> {
        if (value === undefined || value === null || value instanceof FileInfo) {
            return true;
        }

        return false;
    }
    
    defaultMessage?(validationArguments?: ValidationArguments): string {
        return `${validationArguments.property} must be a file.`
    }

}