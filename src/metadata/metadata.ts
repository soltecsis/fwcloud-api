import { ClassConstructor } from "class-transformer";

export type Metadata = {
    validations: {[signature: string]: ClassConstructor<object>}
}

const _metadata: Metadata = {
    validations: {}
}

export const getFWCloudMetadata: Metadata = _metadata;