import { Middleware } from "../fonaments/http/middleware/Middleware";
import fwcError from '../utils/error_table';
import cors from 'cors';
import { Request, Response, NextFunction } from "express";

export class CORS extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction) {
        const options = {
            credentials: true,
            origin: (origin: string, callback: (error: Error, status?: boolean) => void) => {
                if (this.app.config.get('CORS').whitelist.indexOf(origin) !== -1) {
                    this.app.logger.debug('Origin Allowed: ' + origin);
                    callback(null, true);
                } else {
                    this.app.logger.debug('Origin not allowed by cors: ' + origin);
                    callback(new Error('Origin not allowed by CORS: ' + origin));
                }
            }
        }
        this.app.express.options('*', cors(options));
        
        // CORS error handler
        this.app.express.use((err, req, res, next) => {
            res.status(400).send(fwcError.NOT_ALLOWED_CORS);
        });

        next();
    }

}