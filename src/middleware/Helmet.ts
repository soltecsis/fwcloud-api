import { Middleware } from "../fonaments/http/middleware/Middleware";
import helmet from 'helmet';
import { Request, Response, NextFunction } from "express";

export class Helmet extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        this.app.express.use(helmet());
        next();
    }

}