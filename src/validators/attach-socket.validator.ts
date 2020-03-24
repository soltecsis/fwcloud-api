import { RequestValidation } from "../fonaments/validation/request-validation";
import * as Joi from "joi";

export class AttachSocketValidator extends RequestValidation {

    public rules(): Joi.JoiObject {
        return Joi.object({
            socket_id: Joi.string().required().regex(/^[a-zA-Z0-9\-_]{4,64}$/),
        });
    }
}