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
            // It must exists a session before the socket.io connection.
            if (!socket.request.session) {
                logger().error('WebSocket: Session not found');
                socket.disconnect(true);
                return;
            }

            // Make sure we have session data in store synchronized with the object in memory.
            socket.request.session.reload(err => {
                if (err) {
                    logger().error(`WebSocket: Reloading session data from store: ${err.message}`);
                    socket.disconnect(true);
                    return; 
                }

                // Session must contain some mandatory data.
                if (!socket.request.session.keepalive_ts || !socket.request.session || !socket.request.session.customer_id 
                    || !socket.request.session.user_id || !socket.request.session.username || !socket.request.session.pgp) {
                    logger().error('WebSocket: Bad session data.');
                    socket.disconnect(true);
                    return;
                }

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
        });
    }
}