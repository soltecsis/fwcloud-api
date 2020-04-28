import { describeName, expect, testSuite } from "../../mocha/global-setup";
import { Channel } from "../../../src/sockets/channels/channel";
import { SocketMessage } from "../../../src/sockets/messages/socket-message";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { sleep } from "../../utils/utils";
import { AbstractApplication } from "../../../src/fonaments/abstract-application";
import { WebSocketService } from "../../../src/sockets/web-socket.service";

describe(describeName('Channel Unit Tests'), () => {
    let channel: Channel;
    let listener: EventEmitter;
    let app: AbstractApplication;
    let webSocketService: WebSocketService;

    beforeEach(async() => {
        app = testSuite.app;
        webSocketService = await app.getService<WebSocketService>(WebSocketService.name);
        channel = await Channel.make(webSocketService);
        listener = new EventEmitter();
    });

    describe('addMessage()', () => {
        it('should return a socket message', () => {
            const message: SocketMessage = channel.addMessage({});
            expect(message).to.be.instanceof(SocketMessage);
        });

        it('should add the missage into the stack', () => {
            const message: SocketMessage = channel.addMessage({});
        
            expect(channel.pendingMessages).to.have.length(1);
            expect(channel.pendingMessages[0]).to.be.deep.eq(message);
        });

        it('should emit an event', (done) => {
            const p1: Promise<SocketMessage> = new Promise<SocketMessage>((resolve, reject) => {
                channel.on('message:add', (message: SocketMessage) => {
                    resolve(message);
                });
            });

            const p2: Promise<SocketMessage> = new Promise<SocketMessage>((resolve, reject) => {
                return resolve(channel.addMessage({}));
            })
            
            Promise.all([p1, p2]).then((values) => {
                expect(values[0]).to.be.deep.eq(values[1]);
                done();
            });
        });

        it('should not add the message if close has been called', () => {
            channel.close();
            const message: SocketMessage = channel.addMessage({});
            expect(message).to.be.null;
            expect(channel.pendingMessages).to.have.length(0);
        });
    });

    describe('emitMessages()', () => {
        it('should not emit messages if listener is not listening', () => {
            channel.addMessage({});

            channel.emitMessages();

            expect(channel.pendingMessages).to.have.length(1);
        });

        it('should emit messages', () => {
            channel.addMessage({});
            channel.setListener(listener);
            channel.emitMessages();

            expect(channel.pendingMessages).to.have.length(0);
            expect(channel.sentMessages).to.have.length(1);
        });

        it('should emit an event', (done) => {
            const message: SocketMessage = channel.addMessage({});
            channel.setListener(listener);

            channel.on('message:emited', (item: SocketMessage) => {
                expect(item).to.be.deep.eq(message)
                done();
            });

            channel.emitMessages();
        })
    });

    describe('close()', () => {
        it('should set the closed property to true', () => {
            channel.close();

            expect(channel.closed).to.be.true;
        });

        it('should emit an event', (done) => {
            channel.on('closed', () => {
                expect(channel.closed).to.be.true;
                done();
            });

            channel.close();
        });

        it('should wait a grace time before close if there are pending messages', async () => {
            const message = channel.addMessage({});
            channel.close(10);

            expect(channel.closed).to.be.false;
            await sleep(12);
            expect(channel.closed).to.be.true;
        });
    })
});