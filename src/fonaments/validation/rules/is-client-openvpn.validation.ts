import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { In } from 'typeorm';
import { boolean } from 'yargs';
import { OpenVPN } from '../../../models/vpn/openvpn/OpenVPN';
import { Crt } from '../../../models/vpn/pki/Crt';
import db from '../../../database/database-manager';

export function IsClientOpenVPN(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isClientOpenVPN',
      target: object.constructor,
      propertyName: propertyName,
      constraints: [],
      options: validationOptions,
      validator: {
        validate(value: number[] | number, args: ValidationArguments) {
          value = Array.isArray(value) ? value : [value];

          return new Promise<boolean>(async (resolve, reject) => {
            const openvpns: OpenVPN[] = await db
              .getSource()
              .manager.getRepository(OpenVPN)
              .find({
                where: { id: In(value as number[]) },
              });

            if (openvpns.length === 0) return resolve(true);

            for (let i = 0; i < openvpns.length; i++) {
              const crt: Crt = await db
                .getSource()
                .manager.getRepository(Crt)
                .findOne({ where: { id: openvpns[i].crtId } });

              if (openvpns[i].parentId === null || crt.type !== 1)
                return resolve(false);
            }

            return resolve(true);
          });
        },

        defaultMessage(args: ValidationArguments): string {
          return `is not a valid client openvpn`;
        },
      },
    });
  };
}
