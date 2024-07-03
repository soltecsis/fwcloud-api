import { ClassConstructor } from 'class-transformer';

export type Metadata = {
  validations: { [signature: string]: ClassConstructor<object> };
  queryValidation: { [signature: string]: ClassConstructor<object> };
};

const _metadata: Metadata = {
  validations: {},
  queryValidation: {},
};

export const getFWCloudMetadata: Metadata = _metadata;
