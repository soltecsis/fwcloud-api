import { Middleware } from "../fonaments/http/middleware/Middleware";
import session from 'express-session';
import FileStore from 'session-file-store';
import { Request, Response, NextFunction } from "express";

export class Session extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        const config = {
            name: this.app.config.get('session').name,
            secret: this.app.config.get('session').secret,
            saveUninitialized: false,
            resave: true,
            rolling: true,
            store: new (FileStore(session))({
                path: this.app.config.get('session').files_path
            }),
            cookie: {
                httpOnly: false,
                secure: this.app.config.get('session').force_HTTPS, // Enable this when the https is enabled for the API.
                maxAge: this.app.config.get('session').expire * 1000
            }
        }

        session(config)(req, res, next);
        //next();
    }
    
}