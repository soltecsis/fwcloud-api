import { ClassConstructor } from "class-transformer";
import { getFWCloudMetadata } from "../metadata/metadata";

export function Validate(dto?: ClassConstructor<object>) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        getFWCloudMetadata.validations[target.constructor.name + '@' + propertyKey] = dto ?? null;
    };
}