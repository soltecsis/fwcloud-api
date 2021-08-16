import { registerDecorator, ValidationArguments, ValidationOptions, ValidatorConstraint, ValidatorConstraintInterface } from "class-validator";
import { getRepository, In } from "typeorm";
import { OpenVPN } from "../../../models/vpn/openvpn/OpenVPN";

export function IsClientOpenVPN(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
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
            const openvpns: OpenVPN[] = await getRepository(OpenVPN).find(
              {
                where: { id: In(value as number[])}
              }
            );

            return resolve(openvpns.length === 0 ? true : openvpns.filter(item => item.parent !== null).length != 0);
          });
        },

        defaultMessage(args: ValidationArguments): string {
          return `is not a valid client openvpn`
        }
      },
    });
  };
}