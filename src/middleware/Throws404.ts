import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";

export class Throws404 extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        var err: any = new Error('Not Found');
        err.status = 404;
        next(err);
    }
}