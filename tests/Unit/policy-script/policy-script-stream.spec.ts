import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import sinon from 'sinon';
import { PolicyScript } from '../../../src/compiler/policy/PolicyScript';
import { Firewall } from '../../../src/models/firewall/Firewall';
import { PolicyRule } from '../../../src/models/policy/PolicyRule';

const config = require('../../../src/config/config');

describe('PolicyScript stream completion', () => {
  let sandbox: sinon.SinonSandbox;
  let directory: string;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fwcloud-policy-stream-'));
    fs.writeFileSync(path.join(directory, 'header'), '#!/bin/sh\n');
    fs.writeFileSync(path.join(directory, 'footer'), '# end of script\n');
    sandbox
      .stub(config, 'get')
      .withArgs('policy')
      .returns({
        header_file: path.join(directory, 'header'),
        footer_file: path.join(directory, 'footer'),
      });
    sandbox.stub(Firewall, 'getFirewallCompiler').resolves('IPTables');
    sandbox.stub(Firewall, 'getPolicyCompilationMode').resolves('normal');
    sandbox.stub(PolicyRule, 'firewallWithMarkRules').resolves(false);
  });

  afterEach(() => {
    sandbox.restore();
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function prepare(stream: Writable) {
    sandbox.stub(fs, 'createWriteStream').returns(stream as fs.WriteStream);
    const channel = new EventEmitter();
    const messages: string[] = [];
    channel.on('message', (message) => messages.push(message.type));
    const script = Object.assign(Object.create(PolicyScript.prototype), {
      path: path.join(directory, 'policy.sh'),
      fwcloud: 1,
      firewall: 2,
      channel,
    });
    sandbox.stub(script, 'dumpFirewallOptions').resolves();
    sandbox.stub(script, 'dumpPolicyTables').callsFake(async () => {
      stream.write('  :\n');
      return [];
    });
    sandbox.stub(script, 'dumpRouting').resolves();
    const status = sandbox.stub(Firewall, 'updateFirewallStatus').resolves();
    const date = sandbox.stub(Firewall, 'updateFirewallCompileDate').resolves();
    const result = (script as PolicyScript).dump();
    process.nextTick(() => stream.emit('open', 1));
    return { result, status, date, messages };
  }

  it('waits for buffered output before updating the firewall and announcing completion', async () => {
    let flush: (error?: Error) => void;
    let finalizing: () => void;
    const ready = new Promise<void>((resolve) => {
      finalizing = resolve;
    });
    let content = '';
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        content += chunk.toString();
        callback();
      },
      final(callback) {
        flush = callback;
        finalizing();
      },
    });
    const { result, status, date, messages } = prepare(stream);
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await ready;
    // Give an implementation that resolves too early time to finish its DB updates.
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(settled, false);
    sinon.assert.notCalled(status);
    sinon.assert.notCalled(date);
    assert.equal(messages.includes('end'), false);

    flush();
    assert.deepEqual(await result, []);
    assert.equal(stream.writableFinished, true);
    assert.ok(content.endsWith('# end of script\n'));
    sinon.assert.callOrder(status, date);
    assert.equal(messages.includes('end'), true);
  });

  it('rejects a final write error without recording a successful compilation', async () => {
    const error = new Error('disk full');
    const stream = new Writable({
      write(_chunk, _encoding, callback) {
        callback();
      },
      final(callback) {
        setImmediate(() => callback(error));
      },
    });
    const { result, status, date, messages } = prepare(stream);
    await assert.rejects(result, (actual) => actual === error);
    sinon.assert.notCalled(status);
    sinon.assert.notCalled(date);
    assert.equal(messages.includes('end'), false);
  });
});
