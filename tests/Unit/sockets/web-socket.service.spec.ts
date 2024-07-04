import { describeName, testSuite, expect } from '../../mocha/global-setup';
import { AbstractApplication } from '../../../src/fonaments/abstract-application';
import { WebSocketService } from '../../../src/sockets/web-socket.service';
import { Channel } from '../../../src/sockets/channels/channel';

describe(describeName('WebSocketService Unit Tests'), () => {
  let app: AbstractApplication;
  let service: WebSocketService;

  beforeEach(async () => {
    app = testSuite.app;
    service = await app.getService<WebSocketService>(WebSocketService.name);
  });

  it('should be provided as a service', async () => {
    expect(await app.getService<WebSocketService>(WebSocketService.name)).to.be.instanceOf(
      WebSocketService,
    );
  });
});
