import { HttpException } from "./http/http-exception";

export class NotFoundException extends HttpException {
    constructor() {
        super();
        this.status = 404;
        this.info = 'Not Found';
        this.message = this.info;
    }
}