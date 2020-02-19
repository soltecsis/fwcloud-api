import { ErrorMiddleware } from "../fonaments/http/middleware/ErrorMiddleware";
import { Request, Response, NextFunction } from "express";
import { ResponseBuilder } from "../fonaments/http/response-builder";
import { HttpException } from "../fonaments/exceptions/http/http-exception";

export class ErrorResponse extends ErrorMiddleware {
    public handle(error: Error, req: Request, res: Response, next: NextFunction) {
        const status: number = error instanceof HttpException ? error.status : 500;
        
        ResponseBuilder.make(res).status(status).send(error);
    }

}