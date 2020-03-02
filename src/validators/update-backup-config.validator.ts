import { RequestValidation } from "../fonaments/validation/request-validation";
import { JoiObject, object, string, number } from "joi";

export class UpdateBackupConfigValidator extends RequestValidation {

    public rules(): JoiObject {
        return object({
            default_schedule: string().required(),
            default_max_days: number().required(),
            default_max_copies: number().required()
        });
    }
}