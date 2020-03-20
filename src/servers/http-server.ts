import { AbstractWebServer } from "./web-server";
import http from 'http';

export class HttpServer extends AbstractWebServer {
    protected protocol(): string {
        return 'http';
    }
    
    protected async runServer(): Promise<http.Server> {
        return http.createServer(this._application.express);
    }

}