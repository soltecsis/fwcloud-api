import { RequestValidation } from "../fonaments/validation/request-validation";
import { JoiObject, object, string, number } from "joi";

export class UpdateBackupConfigValidator extends RequestValidation {

    public rules(): JoiObject {
        return object({
            schedule: string().required(),
            max_days: number().required(),
            max_copies: number().required()
        });
    }
}