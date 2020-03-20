import { AbstractWebServer } from "./web-server";
import https from 'https';
import * as fs from 'fs';

export class HttpsServer extends AbstractWebServer {
    protected protocol(): string {
        return 'https';
    }
    
    protected async runServer(): Promise<https.Server> {
        const tlsOptions: {
            key: string,
            cert: string,
            ca: string | null
        } = {
            key: fs.readFileSync(this._application.config.get('https').key).toString(),
            cert: fs.readFileSync(this._application.config.get('https').cert).toString(),
            ca: this._application.config.get('https').ca_bundle ? fs.readFileSync(this._application.config.get('https').ca_bundle).toString() : null
        }

        return https.createServer(tlsOptions, this._application.express);
    }
}