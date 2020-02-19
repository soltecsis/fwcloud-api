import { Request } from "express";
import * as Joi from "joi";

export abstract class RequestValidation {
    constructor(protected _req: Request) {}

    public rules(): Joi.JoiObject {
        return Joi.object();
    }

    public async validate(): Promise<any> {
        return await Joi.validate(this._req.inputs.all(), this.rules());
    }
}