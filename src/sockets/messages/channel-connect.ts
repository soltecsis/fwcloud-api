import { Channel } from '../channels/channel';
import { SocketMessage } from './socket-message';
import { Payload } from '../web-socket.service';

export class ChannelConnectRequest extends SocketMessage {
  payload: {
    id: string;
  };
}

export class ChannelConnectResponse extends SocketMessage {
  payload: Payload;

  constructor(channel: Channel) {
    const payload: Payload = {
      id: channel.id,
    };

    super(payload);
  }
}

export class ChannelConnectErrorResponse extends SocketMessage {
  payload: Payload;

  constructor(channelId: string) {
    const payload: Payload = {
      error: `Channel ${channelId} not available`,
    };

    super(payload);
  }
}
