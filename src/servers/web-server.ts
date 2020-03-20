import { AbstractServer } from "./abstract-server";
import https from 'https';
import http from 'http';
import io from 'socket.io';

type WebServer = http.Server | https.Server

export abstract class AbstractWebServer extends AbstractServer<WebServer> {

    protected async bindEvents(): Promise<void> {
        this._server.listen(
            this._application.config.get('listen').port,
            this._application.config.get('listen').ip
        );

        this._server.on('error', (error: Error) => {
            throw error;
        });

        this._server.on('listening', () => {
            console.log('Listening on ' + this.getFullURL())
        })
    }

    protected async webSocketServer(): Promise<void> {
        const _io: io.Server = io(this._server);
        this._application.setSocketIO(_io);

        _io.on('connection', socket => {
            socket.request.session.socket_id = socket.id;
            socket.request.session.save();

            if (this._application.config.get('env') === 'dev') {
                console.log('user connected', socket.id);
            }
            
            socket.on('disconnect', () => {
                if (this._application.config.get('env') === 'dev') {
                    console.log('user disconnected', socket.id);
                }
            });
        });
    }

    protected getFullURL(): string {
        return this.protocol() + '://' + this._application.config.get('listen').ip 
        + ':' 
        + this._application.config.get('listen').port;
    }
}