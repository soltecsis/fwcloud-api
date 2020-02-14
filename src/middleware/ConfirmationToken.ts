import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request, Response, NextFunction } from "express";
import { User } from '../models/user/User';
import randomString from "random-string";

export class ConfirmationToken extends Middleware {
    public async handle(req: Request, res: Response, next: NextFunction) {
        if (this.app.config.get('confirmation_token')) {
            /** Middleware for manage confirmation token. 
             *  Only required for requests that will change the platform information.
             *  Do this before the input data validation process.
             */
            if (req.url.split('/').pop() === 'get' || req.url.split('/').pop() === 'restricted' || req.url.split('/').pop() === 'where'
                || req.method === 'GET' || (req.method === 'POST' && req.path === '/user/login'))
                return next();

            try {
                const test: any = await this.validate(req);
                if (test.result) // Confirmation token successfully validated.
                    next();
                else // Need confirmation, send new token
                    res.status(403).json({ "fwc_confirm_token": test.token });
            } catch (error) { res.status(400).json(error) }
        }
    }

    protected validate(req: any) {
        return new Promise((resolve, reject) => {
            var sql = 'SELECT confirmation_token FROM user WHERE id=' + req.session.user_id;
            req.dbCon.query(sql, async (error, row) => {
                if (error) return reject(error);

                try {
                    if (row) {
                        const dbCT = row[0].confirmation_token; // Confirmation token stored in the data base.
                        const reqCT = req.headers['x-fwc-confirm-token']; // Confirmation token present in the request headers.

                        if (reqCT === undefined || reqCT !== dbCT) {
                            //generate new token
                            const new_token = req.sessionID + "_" + randomString({ length: 20 });
                            await User.updateUserCT(req.session.user_id, new_token)
                            resolve({ "result": false, "token": new_token });
                        } else {
                            //token valid
                            //REMOVE token
                            await User.updateUserCT(req.session.user_id, "")
                            resolve({ "result": true, "token": "" });
                        }
                    } else reject({ "result": false, "token": "" });
                } catch (error) { reject(error) }
            });
        });
    }

}