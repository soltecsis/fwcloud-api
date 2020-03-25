import { HttpException } from "../../fonaments/exceptions/http/http-exception";
import { Snapshot } from "../snapshot";
import { ValidationException } from "../../fonaments/exceptions/validation-exception";

export class SnapshotNotCompatibleException extends ValidationException {
    constructor(protected snapshot: Snapshot) {
        super(null);
        this.status = 422;
        this._errors = [
            {
                name: null,
                message: 'Snapshot is not compatible with the current FwCloud version',
                code: null
            }
        ];
    }
}