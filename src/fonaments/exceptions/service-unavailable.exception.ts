import { HttpException } from "./http/http-exception";

export class ServiceUnavailableException extends HttpException {
    constructor() {
        super();
        this.status = 503;
        this.info = 'Service Unavailable';
        this.message = this.info;
    }
}