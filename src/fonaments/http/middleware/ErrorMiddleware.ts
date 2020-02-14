import { Application } from "../../../Application";
import { Request, Response, NextFunction } from "express";

export abstract class ErrorMiddleware {
    protected app: Application;

    public abstract handle(error: any, req: Request, res: Response, next: NextFunction): void;

    private safeHandler(error: any, req: Request, res: Response, next: NextFunction) {
        try {
            const result = this.handle(error, req, res, next);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public register(app: Application) {
        this.app = app;
        app.express.use((error: any, req: Request, res: Response, next: NextFunction) => {
            this.safeHandler(error, req, res, next);
        });
    }
}