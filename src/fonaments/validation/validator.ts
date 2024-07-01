import { ValidationException } from '../exceptions/validation-exception';
import { validate, validateSync, ValidationError } from 'class-validator';
import {
  ClassConstructor,
  classToPlain,
  ClassTransformOptions,
  plainToClass,
} from 'class-transformer';
import { transformValidationErrorsToErrorBag } from './validation.helper';

export type ErrorBag = { [input: string]: string[] };

export class Validator {
  constructor(
    protected readonly _data: object,
    protected readonly _dto: ClassConstructor<object> | null,
  ) {}

  public async validate(options?: ClassTransformOptions): Promise<void> {
    if (this._dto) {
      const dtoInstance: object = plainToClass(
        this._dto,
        classToPlain(this._data),
        options,
      );
      const errors: ValidationError[] = await validate(dtoInstance, {
        forbidUnknownValues: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      });

      if (errors.length > 0) {
        throw new ValidationException(
          'The given data is invalid.',
          transformValidationErrorsToErrorBag(errors),
        );
      }
    }
  }
}
