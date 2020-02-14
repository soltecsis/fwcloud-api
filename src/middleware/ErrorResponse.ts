import { ErrorMiddleware } from "../fonaments/http/middleware/ErrorMiddleware";
import { Request, Response, NextFunction } from "express";

export class ErrorResponse extends ErrorMiddleware {
    public handle(error: any, req: Request, res: Response, next: NextFunction) {
        this.app.logger.error("Something went wrong: ", error.message);
        res.status(error.status || 500);
        res.render('error', {
            message: error.message,
            error: this.app.express.get('env') === 'dev' ? error : {}
        });
    }

}