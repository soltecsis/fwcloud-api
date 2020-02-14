import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import ejs from 'ejs';
import * as path from 'path';

export class EJS extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        this.app.express.set('views', path.join(this.app.path, 'dist', 'src', 'views'));
        this.app.express.engine('html', ejs.renderFile);
        this.app.express.set('view engine', 'html');
        next();
    }

}