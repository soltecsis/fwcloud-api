import { RequestRules } from "../fonaments/validation/validator";
import { getFWCloudMetadata } from "../metadata/metadata";

export function Validate(rules: RequestRules) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
        getFWCloudMetadata.validations[target.constructor.name + '@' + propertyKey] = rules;
    };
}