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
    fs.writeFileSync(
      path.join(directory, 'header'),
      [
        '#!/bin/sh',
        'FWCLOUD_COMPILATION_DATE="__FWCLOUD_COMPILATION_DATE__"',
        'FWCLOUD_COMPILATION_DATE_UTC="__FWCLOUD_COMPILATION_DATE_UTC__"',
        'FWCLOUD_INSTALLATION_DATE=""',
        'FWCLOUD_INSTALLATION_DATE_UTC=""',
        '',
      ].join('\n'),
    );
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
    sandbox.stub(script, 'dumpCompilation').callsFake(async () => {
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
    assert.match(content, /FWCLOUD_COMPILATION_DATE="\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}"/);
    assert.match(content, /FWCLOUD_COMPILATION_DATE_UTC="\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z"/);
    assert.ok(content.includes('FWCLOUD_INSTALLATION_DATE=""'));
    assert.ok(content.includes('FWCLOUD_INSTALLATION_DATE_UTC=""'));
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

  it('records the installation date before replacing the installed script', () => {
    const footer = fs.readFileSync(path.resolve(process.cwd(), 'config/policy/footer.txt'), 'utf8');
    const recording = "INSTALLATION_DATE=`LC_ALL=C date '+%Y-%m-%d %H:%M:%S'`";
    const utcRecording = 'INSTALLATION_DATE_UTC=`LC_ALL=C date -u +%Y-%m-%dT%H:%M:%SZ`';

    assert.ok(footer.includes(recording));
    assert.ok(footer.includes(utcRecording));
    assert.ok(
      footer.includes(
        'sed -i "s/^FWCLOUD_INSTALLATION_DATE=.*/FWCLOUD_INSTALLATION_DATE=\\"$INSTALLATION_DATE\\"/" "$0" || exit 1',
      ),
    );
    assert.ok(
      footer.includes(
        'sed -i "s/^FWCLOUD_INSTALLATION_DATE_UTC=.*/FWCLOUD_INSTALLATION_DATE_UTC=\\"$INSTALLATION_DATE_UTC\\"/" "$0" || exit 1',
      ),
    );
    assert.ok(footer.indexOf(recording) < footer.indexOf('chmod 700 "$0"'));
    assert.ok(footer.indexOf(utcRecording) < footer.indexOf('chmod 700 "$0"'));
  });

  it('enables strict mode only in the standard policy header', () => {
    const header = fs.readFileSync(path.resolve(process.cwd(), 'config/policy/header.txt'), 'utf8');
    const vyosHeader = fs.readFileSync(
      path.resolve(process.cwd(), 'config/policy/header_VyOS.txt'),
      'utf8',
    );

    assert.match(header, /^#!\/bin\/sh\n\nset -eu\n/);
    assert.doesNotMatch(header, /pipefail/);
    assert.match(vyosHeader, /^#!\/bin\/vbash\n/);
    assert.doesNotMatch(vyosHeader, /set -eu/);
  });

  it('keeps standard iptables open until direct policy loading succeeds', () => {
    const header = fs.readFileSync(path.resolve(process.cwd(), 'config/policy/header.txt'), 'utf8');
    const policyScript = fs.readFileSync(
      path.resolve(process.cwd(), 'src/compiler/policy/PolicyScript.ts'),
      'utf8',
    );

    assert.match(
      header,
      /policy_empty\n {2}if \[ "\$POLICY_COMPILER" = "IPTables" \]; then\n {4}iptables_default_filter_policy ACCEPT\n {2}fi\n {2}policy_load\n {2}options_load/,
    );
    assert.doesNotMatch(header, /if ! policy_load \|\| ! options_load/);
    assert.ok(
      policyScript.indexOf("await this.dumpCompilation(PolicyTypesMap.get('IPv6:DNAT'))") <
        policyScript.indexOf("this.stream.write('iptables_default_filter_policy DROP\\n')"),
    );
  });
});
