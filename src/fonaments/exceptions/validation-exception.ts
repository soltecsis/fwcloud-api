import { ValidationError as JoiValidationError, ValidationErrorItem } from "joi";
import { HttpException } from "./http/http-exception";

export interface InputErrorInterface {
    name: Array<string>,
    message: string;
    code: string;
}
export class ValidationException extends HttpException {
    private _errors: Array<InputErrorInterface>
    
    constructor(protected _error: JoiValidationError) {
        super();
        this.status = 422;
        this.info = 'Unprocessable Entity';
        this.message = this.info;
        this._errors = [];

        _error.details.forEach((detail: ValidationErrorItem) => {
            this._errors.push({
                name: detail.path,
                message: detail.message,
                code: this.transformToFwCloudValidationError(detail.type)
            })
        });
    }

    protected transformToFwCloudValidationError(type: string) {
        return type;
    }

    response(): Object {
        return {
            validation: this._errors
        };
    }
}