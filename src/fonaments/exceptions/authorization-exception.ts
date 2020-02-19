import { HttpException } from "./http/http-exception";

export class AuthorizationException extends HttpException {
    constructor() {
        super();
        this.status = 401;
        this.info = 'Unauthorized';
    }
}