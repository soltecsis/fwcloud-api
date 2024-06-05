import { ClassConstructor } from 'class-transformer';
import { getFWCloudMetadata } from '../metadata/metadata';

export function Validate(dto?: ClassConstructor<object>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    getFWCloudMetadata.validations[
      target.constructor.name + '@' + propertyKey
    ] = dto ?? null;
  };
}

export function ValidateQuery(dto: ClassConstructor<object>) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    getFWCloudMetadata.queryValidation[
      target.constructor.name + '@' + propertyKey
    ] = dto ?? null;
  };
}
