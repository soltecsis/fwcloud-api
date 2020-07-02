import { RequestRules } from "../fonaments/validation/validator"

export type Metadata = {
    validations: {[signature: string]: RequestRules}
}

const _metadata: Metadata = {
    validations: {}
}

export const getFWCloudMetadata: Metadata = _metadata;