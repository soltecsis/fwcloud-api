import { Middleware } from "../fonaments/http/middleware/Middleware";
import method_override from 'method-override';
import { Request, Response, NextFunction } from "express";

export class MethodOverride extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        this.app.express.use(method_override((req, res) => {
            if (req.body && typeof req.body === 'object' && '_method' in req.body) {
                // look in urlencoded POST bodies and delete it
                var method = req.body._method;
                delete req.body._method;
                return method;
            }
        }));

        return next();
    }

}