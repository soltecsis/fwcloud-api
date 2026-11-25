import sinon from 'sinon';
import { expect } from '../../mocha/global-setup';
import { Communication, PolicyInstallationError } from '../../../src/communications/communication';
import { installClusterPolicy } from '../../../src/communications/cluster-policy-installer';

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
