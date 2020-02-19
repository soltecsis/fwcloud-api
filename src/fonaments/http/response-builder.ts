import { Response } from "express";
import { isResponsable } from "../../fonaments/contracts/responsable"
import { InternalServerException } from "../exceptions/internal-server-exception";
import { HttpException } from "../exceptions/http/http-exception";
import { AbstractApplication, app } from "../abstract-application";

export class ResponseBuilder {
    protected _status: number;
    protected _app: AbstractApplication;

    constructor(protected _res: Response) {
        this._app = app();
    }

    public status(status: number): ResponseBuilder {
        this._status = status;
        return this;
    }

    public send(payload: any): ResponseBuilder {
        if (this._status) {
            this._res = this._res.status(this._status);
        }

        this._res.send(this.buildResponse(payload));

        return this;
    }

    public static make(res: Response): ResponseBuilder {
        return new ResponseBuilder(res);
    }

    protected buildResponse(payload: any): Object {
        if (payload instanceof Error) {
            return this.buildErrorResponse(payload);
        }

        return payload;
    }

    protected buildErrorResponse(payload: Error): Object {
        if (payload instanceof HttpException) {
            return payload.toResponse();
        }

        if (this._app.config.get('env') !== 'prod') {
            return payload;
        }

        // In case the exception is not an http exception we generate a 500 exception
        return this.buildErrorResponse(new InternalServerException());
    }
}