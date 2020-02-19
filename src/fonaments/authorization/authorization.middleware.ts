import { Middleware } from "../http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { AuthorizationService } from "./authorization.service";

export class AuthorizationMiddleware extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction): void {
        const authorization: AuthorizationService = this.app.getService(AuthorizationService.name);
        authorization.bindExpressContext(req, res, next);
        next();
    }

}