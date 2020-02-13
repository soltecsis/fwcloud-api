import { Middleware } from "../fonaments/http/middleware/Middleware";
import { Request } from "../fonaments/http/Request";

export class RequestBuilder extends Middleware {
    public handle(req: Express.Request, res: any, next?: (data: any) => void) {
        const r: Request = new Request(req);
    }
}