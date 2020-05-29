import { HttpException } from "../../fonaments/exceptions/http/http-exception";

export class AuthenticationException extends HttpException {
    constructor(message: string = 'User not authenticated') {
        super(message, 401);
    }
}