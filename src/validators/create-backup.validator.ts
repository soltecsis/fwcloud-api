import { RequestValidation } from "../fonaments/validation/request-validation";
import * as Joi from "joi";

export class CreateBackupValidator extends RequestValidation {

    public rules(): Joi.JoiObject {
        return Joi.object({
            name: Joi.string().optional().max(64),
            comment: Joi.string().optional().max(255)
        });
    }
}