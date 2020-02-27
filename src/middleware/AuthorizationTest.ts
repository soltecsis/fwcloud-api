import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { AuthorizationException } from "../fonaments/exceptions/authorization-exception";
import * as fs from "fs";
import * as path from "path";

type SessionData = {
    user_id: number,
    username: string,
    customer_id: number
};

export class AuthorizationTest extends Middleware {
    public handle(req: Request, res: Response, next: NextFunction): void {
        //const logger = this.app.logger;

        // Exclude the login route.
        if (req.method === 'POST' && req.path === '/user/login') {
            return next();
        }

        try {
            if (req.headers.cookie) {
                const fwcloudCookie = this.getFwCloudCookie(req.headers.cookie);

                if (!fwcloudCookie) {
                    throw new AuthorizationException();
                }

                const id: string = this.getSessionIdFromCookie(fwcloudCookie);
                const session_path: string = path.join(this.app.config.get('session').files_path, id + '.json'); 
                if (!fs.existsSync(session_path)) {
                    throw new AuthorizationException();
                }

                let session_data: SessionData = JSON.parse(fs.readFileSync(session_path).toString());

                req.session.customer_id = session_data.customer_id;
                req.session.user_id = session_data.user_id;
                req.session.username = session_data.username;

                // If we arrive here, then the session is correct.
                //logger.debug("USER AUTHORIZED (customer_id: " + req.session.customer_id + ", user_id: " + req.session.user_id + ", username: " + req.session.username + ")");
                return next();
            }

            throw new AuthorizationException();
        } catch (e) {
            next(e);
        }
    }

    protected getFwCloudCookie(cookie: string): string {
        const cookies = cookie.split(';').map((item) => {
            return item.trim();
        })

        for(let i = 0; i < cookies.length; i++) {
            if (new RegExp('^' + this.app.config.get('session').name + '=').test(cookies[i])) {
                return cookies[i].split(this.app.config.get('session').name + '=')[1];
            }
        }
        
        return null;
    }

    protected getSessionIdFromCookie(cookie: string): string {
        return cookie.split('.')[0];
    }

}