import { SocketResponse, ResponsePayload, ErrorResponsePayload } from "./socket-response";
import { Channel } from "../channels/channel";
import { SocketRequest } from "./socket-request";

export class ChannelConnectRequest extends SocketRequest {
    payload: {
        id: string
    } 
}

export class ChannelConnectResponse extends SocketResponse {
    payload: ResponsePayload;

    constructor(channel: Channel) {
        const payload: ResponsePayload = {
            id: channel.id
        };

        super(payload);
    }
}

export class ChannelConnectErrorResponse extends SocketResponse {
    payload: ErrorResponsePayload;
    
    constructor(channelId: string) {
        const payload: ErrorResponsePayload = {
            error: `Channel ${channelId} not available`
        };

        super(payload);
    }
}