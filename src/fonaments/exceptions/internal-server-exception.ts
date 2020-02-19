import { HttpException } from "./http/http-exception";

export class InternalServerException extends HttpException {
    constructor() {
        super();
        this.message = 'Internal Server Error';
        this.status = 500;
        this.name = this.constructor.name;
    }
}