import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { In } from 'typeorm';
import { IPObjGroup } from '../../../models/ipobj/IPObjGroup';
import db from '../../../database/database-manager';

export function IpObjGroupBelongsToTypes(
  typeIds: number[],
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'ipObjBelongsToTypes',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [typeIds],
      options: validationOptions,
      validator: {
        validate(value: number[] | number, args: ValidationArguments) {
          value = Array.isArray(value) ? value : [value];

          return new Promise<boolean>(async (resolve, reject) => {
            const validTypes: number[] = args.constraints[0];
            const ipObjs: IPObjGroup[] = await db
              .getSource()
              .manager.getRepository(IPObjGroup)
              .find({
                where: { id: In(value as number[]) },
              });

            const failed: IPObjGroup[] = ipObjs.filter(
              (group: IPObjGroup) => !validTypes.includes(group.type),
            );

            return resolve(failed.length === 0);
          });
        },

        defaultMessage(args: ValidationArguments): string {
          return `at least one group is not valid`;
        },
      },
    });
  };
}
