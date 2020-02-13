import { Application } from "./Application";
import https from 'https';
import http from 'http';
import * as fs from 'fs';
import io from 'socket.io';

export class Server {
    private _application: Application;
    private _config;
    private _server: https.Server | http.Server;

    constructor(app: Application) {
        this._application = app;
        this._config = app.config;
    }

    public async start(): Promise<any> {
        try {
            if (this.isHttps()) {
                this._server = this.startHttpsServer();
            }
            this._server = this.startHttpServer();

            this.bootstrapSocketIO();
            this.bootstrapEvents();

        } catch (error) {
            console.error("ERROR CREATING HTTP/HTTPS SERVER: ", error);
            process.exit(1);
        }

        return this;
    }

    private startHttpsServer(): https.Server {
        const tlsOptions: {
            key: string,
            cert: string,
            ca: string | null
        } = {
            key: fs.readFileSync(this._config.get('https').key).toString(),
            cert: fs.readFileSync(this._config.get('https').cert).toString(),
            ca: this._config.get('https').ca_bundle ? fs.readFileSync(this._config.get('https').ca_bundle).toString() : null
        }

        return https.createServer(tlsOptions, this._application.express);
    }

    private startHttpServer(): http.Server {
        return http.createServer(this._application.express);
    }

    private bootstrapEvents() {
        this._server.listen(
            this._config.get('listen').port,
            this._config.get('listen').ip
        );
        this._server.on('error', (error) => {
            this.onError(error);
        });
        this._server.on('listening', () => {
            this.onListening();
        });

    }

    private bootstrapSocketIO() {
        const _io = io();
        this._application.express.set('socketio', _io);

        _io.on('connection', socket => {
            if (this._config.get('env') === 'dev') console.log('user connected', socket.id);
            socket.on('disconnect', () => {
                if (this._config.get('env') === 'dev') console.log('user disconnected', socket.id);
            });
        });
    }

    public onError(error: Error) {
        console.error(error.message);
        throw error;
    }

    public onListening() {
        var addr = this._server.address();
        var bind = typeof addr === 'string'
            ? 'pipe ' + addr
            : 'port ' + addr.port;
        console.log('Listening on ' + bind);
    }

    public isHttps(): boolean {
        return this._config.get('https').enabled;
    }
}