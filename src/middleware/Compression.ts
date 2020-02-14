import { Middleware } from "../fonaments/http/middleware/Middleware";
import compression from 'compression';
import { Request, Response, NextFunction } from "express";

export class Compression extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        this.app.express.use(compression());
        next();
    }

}