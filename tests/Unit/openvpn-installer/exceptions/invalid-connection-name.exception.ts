import { FwCloudError } from "../../../../src/fonaments/exceptions/error";

export class InvalidConnectionNameException extends FwCloudError {
    constructor(name: string) {
        super(`Connection name is not valid: ${name}`);
    }
    
}