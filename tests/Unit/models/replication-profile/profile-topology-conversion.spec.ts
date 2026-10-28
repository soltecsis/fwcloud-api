import { expect, testSuite } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';
import { convertProfileProvisionTarget } from '../../../../src/models/replication-profile/profile-topology-conversion';
import { ReplicationProfileService } from '../../../../src/models/replication-profile/replication-profile.service';
import { ReplicationProfile } from '../../../../src/models/replication-profile/replication-profile.model';

const model = () => ({
  policyStructure: {
    interfaces: [{ name: 'eth1', role: 'lan' }],
    rules: [{ chain: 'input', nodeRole: 'backup', comment: 'Node policy' }],
    system: {
      keepalived: [
        {
          interfaceRole: 'lan',
          masterNode: 'backup',
          nodeRole: 'primary',
          active: false,
          style: 'custom',
          virtualIps: [{ kind: 'address', value: '192.0.2.254' }],
        },
        { rule_type: 2, cfg_text: '# Native VRRP\r\n', nodeRole: 'backup', active: true },
      ],
    },
  },
});

describe('Profile native topology conversion', () => {
  it('converts node restrictions locally and retains all Keepalived settings', () => {
    const provision = getProfileProvisioning(model());
    const original = structuredClone(provision);
    const result = convertProfileProvisionTarget(provision, 'firewall');
    expect(result.provision.rules[0]).not.to.have.property('nodeRole');
    expect(result.provision.system.keepalived).to.have.length(2);
    expect(
      result.provision.system.keepalived.every((entry) => entry.nodeRole === undefined),
    ).to.equal(true);
    expect(result.provision.system.keepalived[0]).to.include({
      masterNode: 'backup',
      active: false,
      style: 'custom',
      interfaceRole: 'lan',
    });
    expect(result.provision.system.keepalived[1]).to.include({
      rule_type: 2,
      cfg_text: '# Native VRRP\r\n',
      active: true,
    });
    expect(result.warnings.join(' '))
      .to.include('1 policy rule(s)')
      .and.include('2 Keepalived rule(s)')
      .and.include('retained');
    expect(provision).to.deep.equal(original);
  });

  it('retains node restrictions when the destination is a cluster', () => {
    const provision = getProfileProvisioning(model());
    const result = convertProfileProvisionTarget(provision, 'cluster');
    expect(result.provision).to.equal(provision);
    expect(result.provision.rules[0].nodeRole).to.equal('backup');
    expect(result.provision.system.keepalived[0].nodeRole).to.equal('primary');
    expect(result.warnings).to.deep.equal([]);
  });

  it('leaves legacy source-based profiles unchanged', () => {
    expect(convertProfileProvisionTarget(null, 'firewall')).to.deep.equal({
      provision: null,
      warnings: [],
    });
  });

  it('supports both kinds for historical declarative single-kind templates', async () => {
    const service = await testSuite.app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    for (const kind of ['firewall', 'cluster'] as const) {
      const profile = { targetKind: kind } as ReplicationProfile;
      const saved = { ...model(), compatibility: { target_kinds: [kind] } };
      expect(service.supportsTargetKind(profile, 'firewall', saved)).to.equal(true);
      expect(service.supportsTargetKind(profile, 'cluster', saved)).to.equal(true);
    }
  });

  it('preserves explicit compatibility for source-based replicas and unreadable templates', async () => {
    const service = await testSuite.app.getService<ReplicationProfileService>(
      ReplicationProfileService.name,
    );
    const profile = { targetKind: 'firewall' } as ReplicationProfile;
    const saved = { replicate: {}, compatibility: { target_kinds: ['firewall'] } };
    expect(service.supportsTargetKind(profile, 'cluster', saved)).to.equal(false);
    expect(service.supportsTargetKind(profile, 'cluster', null)).to.equal(false);
    expect(service.supportsTargetKind(profile, 'firewall', null)).to.equal(true);
  });
});
