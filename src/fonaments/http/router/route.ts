import { HttpMethod, RouterService } from "./router.service";
import { PathParams } from "express-serve-static-core"
import { Controller } from "../controller";
import { Request, Response, NextFunction, Application } from "express";
import { RequestValidation } from "../../validation/request-validation";
import { Gate } from "./gate";
import { AbstractApplication, app } from "../../abstract-application";
import { ParamNotValidException } from "./exceptions/param-not-valid.exception";
import { ParamMissingException } from "./exceptions/param-missing.exception";

export class ControllerHandlerSignature {
    controller: typeof Controller;
    method: string
};

export type RequestHandlerCallback = (request: Request, response: Response) => void;

export class Route {

    protected _app: AbstractApplication;
    protected _router: Express.Application;

    protected _pathParams: PathParams;
    protected _httpMethod: HttpMethod;
    protected _controllerSignature?: ControllerHandlerSignature
    protected _callback?: RequestHandlerCallback;
    protected _validator?: any; //TODO
    protected _gates: Array<typeof Gate>;
    protected _name: string;

    constructor() {

        this._httpMethod = null;
        this._pathParams = null;
        this._controllerSignature = null;
        this._validator = null;
        this._gates = [];
        this._name = null;
        this._app = app();
        this._router = app().express;
    }

    get name(): string {
        return this._name;
    }

    get gates(): Array<typeof Gate> {
        return this._gates;
    }

    get validator(): any {
        return this._validator;
    }

    get httpMethod(): HttpMethod {
        return this._httpMethod;
    }

    get pathParams(): PathParams {
        return this._pathParams;
    }

    get controllerSignature(): ControllerHandlerSignature {
        return this._controllerSignature;
    }

    get callback(): RequestHandlerCallback {
        return this._callback;
    }

    public setHttpMethod(httpMethod: HttpMethod): Route {
        this._httpMethod = httpMethod;
        return this;
    }

    public setPathParams(pathParams: PathParams): Route {
        this._pathParams = pathParams;
        return this;
    }

    public setControllerHandler(controllerHandler: ControllerHandlerSignature): Route {
        this._controllerSignature = controllerHandler;
        return this;
    }

    public setCallbackHandler(callback: RequestHandlerCallback): Route {
        this._callback = callback;
        return this;
    }

    public setRequestValidation(validator: typeof RequestValidation): Route {
        this._validator = validator;
        return this;
    }

    public setName(name: string): Route {
        this._name = name;
        return this;
    }

    public isCallbackHandler(): boolean {
        return this._controllerSignature === null;
    }

    public isControllerHandler(): boolean {
        return this._controllerSignature !== null;
    }

    public setGates(gates: Array<typeof Gate>): Route {
        this._gates = gates;
        return this;
    }

    public generateURL(params: object = {}): string {
        let url: string = this._pathParams.toString();

        for (let param in params) {
            if (Object.prototype.hasOwnProperty.call(params, param)) {

                if (new RegExp('\/').test(params[param])) {
                    throw new ParamNotValidException(param, params[param], this);
                }

                url = url.replace(new RegExp('\:' + param), params[param]);

            }
        }

        //TODO: Should use the regexp path restrictions in order to validate params
        // are valid
        url = url.replace(new RegExp('\\(.+\\)'), "");

        const occurrences = url.match(new RegExp('\:[A-Za-z0-9]+'));
        if (occurrences && occurrences.length > 0) {
            throw new ParamMissingException(occurrences, this);
        }

        return url;
    }
}