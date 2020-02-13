import { Application } from "../../../Application";

export abstract class Middleware {
    protected app: Application;

    public abstract handle(req: any, res: any, next?: (data: any) => void );

    private safeHandler(req: Express.Request | Request, res: Express.Response, next?: (data: any) => void) {
        try {
            this.handle(req, res, next);
        } catch (e) {
            console.error(e);
            throw e;
        }
    }

    public register(app: Application) {
        this.app = app;
        app.express.use((req, res, next?) => {this.safeHandler(req, res, next);});
    }
}