import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { getRepository, In } from "typeorm";
import { IPObj } from "../../../models/ipobj/IPObj";

export function IpObjBelongsToTypes(typeIds: number[], validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'ipObjBelongsToTypes',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [typeIds],
      async: true,
      options: validationOptions,
      validator: {
        async validate(value: number[] | number, args: ValidationArguments) {
          value = Array.isArray(value) ? value : [value];

          const validTypes: number[] = args.constraints[0];
          const ipObjs: IPObj[] = await getRepository(IPObj).find(
            {
              where: { id: In(value as number[])}
            }
          );

          const failed: IPObj[] = ipObjs.filter((ipObj: IPObj) => !validTypes.includes(ipObj.ipObjTypeId));

          return failed.length === 0;
        },

        defaultMessage(args: ValidationArguments): string {
          return `at least one ipObj is not valid`
        }
      }
    });
  };
}