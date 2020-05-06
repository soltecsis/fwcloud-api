import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { WebSocketService } from "../../../src/sockets/web-socket.service";
import { Channel } from "../../../src/sockets/channels/channel";

describe(describeName('WebSocketService Unit Tests'), () => {
    let app: AbstractApplication;
    let service: WebSocketService;

    beforeEach(async() => {
        app = testSuite.app;
        service = await app.getService<WebSocketService>(WebSocketService.name);
    });

    it('should be provided as a service', async () => {
        expect(await app.getService<WebSocketService>(WebSocketService.name)).to.be.instanceOf(WebSocketService);
    });

    describe('createChannel()', () => {
        it('should create a channel', () => {
            const channel: Channel = service.createChannel();

            expect(channel).to.be.instanceOf(Channel);
        });

        it('should add the channel into the channel array', async () => {
            const channel: Channel = service.createChannel();
            expect(service.channels.indexOf(channel)).to.be.greaterThan(-1);
        })

        it('should remove the channel if the channel emits is closed', (done) => {
            const channel: Channel = service.createChannel();

            channel.on('closed', () => {
                expect(service.getChannel(channel.id)).to.be.null;
                done();
            });
            
            channel.close();
        })
    });

    describe('getChannel()', () => {
        it('should return a channel instance', async () => {
            const channel: Channel = service.createChannel();
            expect(service.getChannel(channel.id)).to.be.deep.eq(channel);
        });
    });
});