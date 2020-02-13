import { Middleware } from "../fonaments/http/middleware/Middleware";
import bodyParser from 'body-parser';

export class BodyParser extends Middleware {
    public handle(req: any, res: any, next?: (data?: any) => void) {
        return (bodyParser.json())(req, res, next);
    }

}