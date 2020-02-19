import { Service } from "../services/service";
import { AbstractApplication } from "../abstract-application";
import { Request, Response, NextFunction } from "express";
import { AuthorizationException } from "../exceptions/authorization-exception";


export class AuthorizationService extends Service {
    protected _policies: Array<any>;
    
    protected _req: Request;
    protected _res: Response;
    protected _next: NextFunction;

    constructor(protected _app: AbstractApplication) {
        super(_app);
        this._next = null;
        this._req = null;
        this._res = null;
    }

    public bindExpressContext(req: Request, res: Response, next: NextFunction) {
        this._req = req;
        this._res = res;
        this._next = next;
    }

    public async revokeAuthorization(): Promise<void> {
        const exception = new AuthorizationException();
        this._next(exception);
        throw exception;
    }
}