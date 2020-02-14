import { Middleware } from "../fonaments/http/middleware/Middleware";
import accessCtrl from '../authorization/access_control';
import { Request, Response, NextFunction } from "express";

export class AccessControl extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        accessCtrl.check(req, res, next);
    }

}