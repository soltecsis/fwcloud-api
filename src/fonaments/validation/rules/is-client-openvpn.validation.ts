import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';
import { In } from 'typeorm';
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

          return new Promise<boolean>((resolve, reject) => {
            db.getSource()
              .manager.getRepository(OpenVPN)
              .find({
                where: { id: In(value) },
              })
              .then((openvpns: OpenVPN[]) => {
                if (openvpns.length === 0) return resolve(true);
                for (let i = 0; i < openvpns.length; i++) {
                  db.getSource()
                    .manager.getRepository(Crt)
                    .findOne({ where: { id: openvpns[i].crtId } })
                    .then((crt: Crt) => {
                      if (openvpns[i].parentId === null || crt.type !== 1) return resolve(false);
                    })
                    .catch((err) => {
                      reject(err);
                    });
                }
              })
              .catch((err) => {
                reject(err);
              });

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
