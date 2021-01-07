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
        return this._socketIO.sockets.sockets.get(socketId) || null;
    }

    public setSocketIO(socketIO: io.Server) {
        this._socketIO = socketIO;

        this._socketIO.on('connection', socket => {
            socket.request.session.socketId = socket.id;
            socket.request.session.save(err => {
                if (err) { logger().error(`WebSocket: Storing socket.io id in session file: ${err.message}`); }
                else socket.request.session.reload(err => { });
            });

            logger().info(`WebSocket: User connected (ID: ${socket.id}, IP: ${socket.handshake.address}, session: ${socket.request.session.id})`);
            
            socket.on('disconnect', () => {
                logger().info(`WebSocket: User disconnected (ID: ${socket.id}, IP: ${socket.handshake.address}, session: ${socket.request.session.id})`);
            });
        });
    }
}