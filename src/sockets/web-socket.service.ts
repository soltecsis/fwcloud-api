import { Service } from "../fonaments/services/service";
import { Channel } from "./channels/channel";
import io from 'socket.io';
import { logger } from "../fonaments/abstract-application";

export type Payload = object;

export type MessageEvents = 'message:add' | 'message:remove';

export class WebSocketService extends Service {
    protected _channels: Array<Channel> = [];

    protected _socketIO: io.Server;
    
    public async build(): Promise<WebSocketService> {
        return this;
    }

    get channels(): Array<Channel> {
        return this._channels;
    }

    public hasSocket(socketId: string): boolean {
        return this.getSocket(socketId) !== null;
    }

    public getSocket(socketId: string): io.Socket {
        if (this._socketIO.sockets.connected[socketId]) {
            return this._socketIO.sockets.connected[socketId];
        }

        return null;
    }

    public setSocketIO(socketIO: io.Server) {
        this._socketIO = socketIO;

        this._socketIO.on('connection', socket => {
            socket.request.session.socketId = socket.id;
            socket.request.session.save();

            if (this._app.config.get('env') === 'dev') {
                logger().info('user connected', socket.id);
            }
            
            socket.on('disconnect', () => {
                if (this._app.config.get('env') === 'dev') {
                    logger().info('user disconnected', socket.id);
                }
            });
        });
    }
}