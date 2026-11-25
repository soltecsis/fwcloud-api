import sinon from 'sinon';
import { EventEmitter } from 'events';
import { expect } from '../../../mocha/global-setup';
import {
  Communication,
  PolicyInstallationError,
} from '../../../../src/communications/communication';
import { installClusterPolicy } from '../../../../src/models/firewall/cluster-policy-installer';

describe('cluster policy installation', () => {
  const backup = { backupName: 'fwcloud-20261123120000.sh', scriptPath: '/etc/fwcloud/fwcloud.sh' };

  function node(firewallId: number) {
    const install = sinon.stub().resolves(backup);
    const recover = sinon.stub().resolves();
    return {
      firewallId,
      install,
      recover,
      communication: {
        installCoordinatedFirewallPolicy: install,
        recoverFirewallPolicy: recover,
      } as unknown as Communication<unknown>,
    };
  }

  it('installs all nodes in order without recovery on success', async () => {
    const first = node(1);
    const second = node(2);
    const result = await installClusterPolicy([first, second], '/tmp/fwcloud.sh');
    expect(result.success).to.be.true;
    expect(first.install.calledBefore(second.install)).to.be.true;
    expect(first.recover.called || second.recover.called).to.be.false;
  });

  it('preserves an arbitrary supplied order and waits for each node before starting the next', async () => {
    const first = node(30);
    const second = node(10);
    const third = node(20);
    let finishFirst: (value: typeof backup) => void;
    first.install.returns(new Promise((resolve) => (finishFirst = resolve)));

    const installation = installClusterPolicy([first, second, third], '/tmp/fwcloud.sh');
    expect(first.install.calledOnce).to.be.true;
    expect(second.install.called || third.install.called).to.be.false;
    finishFirst(backup);
    const result = await installation;

    expect(first.install.calledBefore(second.install)).to.be.true;
    expect(second.install.calledBefore(third.install)).to.be.true;
    expect(result.nodes.map((item) => item.firewallId)).to.deep.equal([30, 10, 20]);
  });

  it('recovers the correct backups and skips pending nodes in a reordered installation', async () => {
    const first = node(30);
    const second = node(10);
    const failing = node(20);
    const pending = node(5);
    const firstBackup = {
      backupName: 'fwcloud-20261123120001.sh',
      scriptPath: '/first/fwcloud.sh',
    };
    const secondBackup = {
      backupName: 'fwcloud-20261123120002.sh',
      scriptPath: '/second/fwcloud.sh',
    };
    first.install.resolves(firstBackup);
    second.install.resolves(secondBackup);
    failing.install.rejects(new PolicyInstallationError('failed', 'restored', new Error('failed')));

    const result = await installClusterPolicy([first, second, failing, pending], '/tmp/fwcloud.sh');

    expect(result.nodes.map((item) => item.firewallId)).to.deep.equal([30, 10, 20, 5]);
    expect(first.recover.calledOnceWithExactly(firstBackup, sinon.match.any)).to.be.true;
    expect(second.recover.calledOnceWithExactly(secondBackup, sinon.match.any)).to.be.true;
    expect(failing.recover.called || pending.install.called || pending.recover.called).to.be.false;
    expect(result.nodes[3].installation).to.equal('pending');
  });

  it('recovers completed nodes once and leaves pending nodes untouched', async () => {
    const first = node(1);
    const second = node(2);
    const pending = node(3);
    second.install.rejects(new PolicyInstallationError('failed', 'restored', new Error('failed')));
    const result = await installClusterPolicy([first, second, pending], '/tmp/fwcloud.sh');
    expect(result.success).to.be.false;
    expect(first.recover.calledOnceWithExactly(backup, sinon.match.any)).to.be.true;
    expect(second.recover.called || pending.install.called || pending.recover.called).to.be.false;
    expect(result.nodes.map((item) => item.recovery)).to.deep.equal([
      'restored',
      'restored',
      'not_needed',
    ]);
  });

  it('reports a node failure and waits one second before recovering completed nodes', async () => {
    const clock = sinon.useFakeTimers();
    try {
      const first = node(1);
      const failing = node(2);
      const events = new EventEmitter();
      const messages: Array<{ type: string; message: string }> = [];
      events.on('message', (message) => messages.push(message));
      failing.install.rejects(new Error('node unavailable'));

      const installation = installClusterPolicy([first, failing], '/tmp/fwcloud.sh', events);
      await clock.tickAsync(999);
      expect(
        messages.some((message) => message.type === 'error' && message.message.includes('node 2')),
      ).to.be.true;
      expect(first.recover.called).to.be.false;
      expect(messages.some((message) => message.message.includes('Restoring previous'))).to.be
        .false;

      await clock.tickAsync(1);
      await installation;
      expect(first.recover.calledOnce).to.be.true;
      const failureIndex = messages.findIndex(
        (message) => message.type === 'error' && message.message.includes('node 2'),
      );
      const recoveryIndex = messages.findIndex((message) =>
        message.message.includes('Restoring previous'),
      );
      expect(failureIndex).to.be.lessThan(recoveryIndex);
    } finally {
      clock.restore();
    }
  });

  it('continues recovery after an error and reports missing backups', async () => {
    const first = node(1);
    const second = node(2);
    const third = node(3);
    const failing = node(4);
    first.install.resolves(null);
    second.recover.rejects(new Error('connection lost'));
    failing.install.rejects(
      new PolicyInstallationError('failed', 'unavailable', new Error('failed')),
    );
    const result = await installClusterPolicy([first, second, third, failing], '/tmp/fwcloud.sh');
    expect(result.nodes.map((item) => item.recovery)).to.deep.equal([
      'unavailable',
      'unknown',
      'restored',
      'unavailable',
    ]);
    expect(first.recover.called).to.be.false;
    expect(second.recover.calledOnce && third.recover.calledOnce).to.be.true;
  });

  it('leaves all later nodes pending when the first installation fails', async () => {
    const first = node(1);
    const second = node(2);
    first.install.rejects(new PolicyInstallationError('failed', 'restored', new Error('failed')));
    const result = await installClusterPolicy([first, second], '/tmp/fwcloud.sh');
    expect(result.nodes[1].installation).to.equal('pending');
    expect(first.recover.called || second.install.called).to.be.false;
  });

  it('recovers every completed node when the last installation fails', async () => {
    const first = node(1);
    const second = node(2);
    const last = node(3);
    last.install.rejects(new PolicyInstallationError('failed', 'restored', new Error('failed')));
    await installClusterPolicy([first, second, last], '/tmp/fwcloud.sh');
    expect(first.recover.calledOnce && second.recover.calledOnce).to.be.true;
    expect(last.recover.called).to.be.false;
  });
});
