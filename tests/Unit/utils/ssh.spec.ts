import { EventEmitter } from 'node:events';
import { expect } from 'chai';
import sinon from 'sinon';
import sshTools from '../../../src/utils/ssh';

describe('SSH sudo password prompts', () => {
  const ssh2 = require('ssh2');
  let stream: EventEmitter & { stderr: EventEmitter; write: sinon.SinonSpy };

  beforeEach(() => {
    stream = Object.assign(new EventEmitter(), {
      stderr: new EventEmitter(),
      write: sinon.spy(),
    });
    const connection = Object.assign(new EventEmitter(), {
      connect: () => connection.emit('ready'),
      exec: (_command: string, _options: object, callback: (error: null, value: object) => void) =>
        callback(null, stream),
      end: sinon.spy(),
    });
    sinon.stub(ssh2, 'Client').returns(connection);
  });

  afterEach(() => sinon.restore());

  for (const prompt of [
    '[sudo] Password:',
    'notice\r\n[sudo: authenticate] Password for fwcloud: ',
    '[sudo] Contraseña:',
  ]) {
    it(`answers ${JSON.stringify(prompt)} once`, async () => {
      const result = sshTools.runCommand({ password: 'test-password' }, 'sudo true');
      stream.emit('data', Buffer.from(prompt));
      stream.emit('data', Buffer.from(prompt));
      stream.emit('close', 0);

      sinon.assert.calledOnceWithExactly(stream.write, 'test-password\n');
      expect(await result).to.equal(prompt);
    });
  }

  it('keeps incomplete prompts in command output', async () => {
    const output = '[sudo: authenticate] Password for fwcloud';
    const result = sshTools.runCommand({ password: 'test-password' }, 'sudo true');
    stream.emit('data', Buffer.from(output));
    stream.emit('close', 0);

    sinon.assert.notCalled(stream.write);
    expect(await result).to.equal(output);
  });

  it('removes fragmented sudo password feedback without removing script output', async () => {
    const events = new EventEmitter();
    const messages: Array<{ message: string }> = [];
    events.on('message', (message) => messages.push(message));
    const result = sshTools.runCommand({ password: 'test-password' }, 'sudo true', events);
    stream.emit('data', Buffer.from('[sudo] Password:'));
    stream.emit('data', Buffer.from('***'));
    stream.emit('data', Buffer.from('**\b \b\b \b'));
    stream.emit('data', Buffer.from('\r\nFWCloud.net\r\n'));
    stream.emit('close', 0);

    expect(await result).to.contain('FWCloud.net');
    expect(messages.map((message) => message.message).join('')).not.to.contain('*');
    expect(messages.map((message) => message.message).join('')).not.to.contain('\b');
  });

  it('preserves a script banner containing asterisks when sudo prints no feedback', async () => {
    const result = sshTools.runCommand({ password: 'test-password' }, 'sudo true');
    stream.emit('data', Buffer.from('[sudo] Password:'));
    stream.emit('data', Buffer.from('*****\r\n* FILTER TABLE *\r\n'));
    stream.emit('close', 0);
    expect(await result).to.equal('*****\r\n* FILTER TABLE *\r\n');
  });
});
