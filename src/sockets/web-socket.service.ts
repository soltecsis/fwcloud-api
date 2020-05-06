import { Service } from "../fonaments/services/service";
import { Channel } from "./channels/channel";
import io from 'socket.io';
import { ChannelConnectResponse, ChannelConnectErrorResponse, ChannelConnectRequest } from "./messages/channel-connect";
import { SocketMessage } from "./messages/socket-message";

export type Payload = object;

export type MessageEvents = 'message:add' | 'message:remove';

export class WebSocketService extends Service {
    protected _channels: Array<Channel> = [];

    protected _socketIO: io.Server;
    
    public async build(): Promise<WebSocketService> {
        return this;
    }

    public async close(): Promise<void> {
        for(let i = 0; i < this._channels.length; i++) {
            this._channels[i].close();
        }
    }

    get channels(): Array<Channel> {
        return this._channels;
    }

    public createChannel(): Channel {
        const channel: Channel = new Channel();
        this._channels.push(channel);

        channel.on('closed', () => {
            const index: number = this._channels.indexOf(channel);

            if (index >= 0) {
                this._channels.splice(index, 1);
            }
        });

        return channel;
    }

    public getChannel(channel_id: string): Channel {
        const channels = this._channels.filter((channel) => {
            return channel.id === channel_id;
        });

        return channels.length > 0 ? channels[0] : null;
    }

    public setSocketIO(socketIO: io.Server) {
        this._socketIO = socketIO;

        this._socketIO.on('channel:connect', (socket: io.Socket, message: ChannelConnectRequest) => {
            const channel: Channel = this.getChannel(message.id);

            try {
                channel.setListener(socket);
                socket.emit('channel:connect', new ChannelConnectResponse(channel));
                channel.emitMessages();
            } catch (error) {
                socket.emit('channel:connect', new ChannelConnectErrorResponse(message.id));
            }
        });
    }
}