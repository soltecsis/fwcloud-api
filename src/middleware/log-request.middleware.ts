import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { logger } from "../fonaments/abstract-application";
import moment from "moment";

export class LogRequestMiddleware extends Middleware {
    public async handle(req: Request, res: Response, next: NextFunction): Promise<void> {
        logger('http').log('entry', `${req.ip} -- [${moment().format('DD/MMM/YYYY:HH:mm:ss ZZ')}] "${req.method.toUpperCase()} ${req.url} HTTP/${req.httpVersion}"`)
        next();
    }

}