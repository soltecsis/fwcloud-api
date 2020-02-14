import { Application } from "../../../Application";
import { Request, Response, NextFunction } from "express";

export abstract class Middleware {
    protected app: Application;

    public abstract handle(req: Request, res: Response, next: NextFunction): void;

    private safeHandler(req: Request, res: Response, next: NextFunction) {
        try {
            const result = this.handle(req, res, next);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public register(app: Application) {
        this.app = app;
        app.express.use((req: Request, res: Response, next: NextFunction) => {
            this.safeHandler(req, res, next);
        });
    }
}