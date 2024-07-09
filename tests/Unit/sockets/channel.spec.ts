import { describeName, expect } from '../../mocha/global-setup';
import { Channel } from '../../../src/sockets/channels/channel';
import { SocketMessage } from '../../../src/sockets/messages/socket-message';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import * as uuid from 'uuid';

describe(describeName('Channel Unit Tests'), () => {
  let channel: Channel;
  let listener: EventEmitter;

  beforeEach(async () => {
    listener = new EventEmitter();
    channel = new Channel(uuid.v1(), listener);
  });

  describe('message()', () => {
    it('should return a boolean', () => {
      const value: boolean = channel.message({});
      expect(value).to.be.false;
    });

    it('should emit an event', (done) => {
      listener.on(channel.id, (message: SocketMessage) => {
        expect(message.payload).to.be.deep.eq({});
        done();
      });

      channel.message({});
    });
  });
});
