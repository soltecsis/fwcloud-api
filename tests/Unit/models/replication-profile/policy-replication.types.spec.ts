import { describeName, expect } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';

describe(describeName('Policy Replication Types Unit Tests'), () => {
  it('should normalize policyStructure interface objects into declarative provisioning', () => {
    const provision = getProfileProvisioning({
      policyStructure: {
        interfaces: [{ name: 'WAN' }],
        rules: [
          {
            action: 'accept',
            source: [{ type: 'interface', value: 'LAN' }],
            destination: [{ type: 'interface', value: 'WAN' }],
            service: [{ type: 'service', value: 'tcp/443' }],
            comment: 'Allow LAN to WAN HTTPS',
          },
        ],
      },
    });

    expect(provision).to.deep.equal({
      interfaces: [
        { name: 'WAN', role: 'WAN' },
        { name: 'LAN', role: 'LAN' },
      ],
      rules: [
        {
          chain: 'forward',
          action: 'accept',
          inRole: 'LAN',
          outRole: 'WAN',
          service: { protocol: 'tcp', port: 443 },
          comment: 'Allow LAN to WAN HTTPS',
        },
      ],
    });
  });

  it('should support custom role names in the legacy provision shape', () => {
    const provision = getProfileProvisioning({
      provision: {
        interfaces: [{ name: 'Office LAN', role: 'office-lan' }],
        rules: [{ action: 'deny', sourceRole: 'office-lan', service: 'udp/53' }],
      },
    });

    expect(provision).to.deep.equal({
      interfaces: [{ name: 'Office LAN', role: 'office-lan' }],
      rules: [
        {
          chain: 'forward',
          action: 'deny',
          inRole: 'office-lan',
          outRole: undefined,
          service: { protocol: 'udp', port: 53 },
          comment: undefined,
        },
      ],
    });
  });

  it('should keep structure-only models in the provisioning apply flow', () => {
    expect(
      getProfileProvisioning({
        policy_structure: {
          mode: 'json',
          value: { policies: { ipv4: { forward: [] } } },
        },
      }),
    ).to.deep.equal({ interfaces: [], rules: [] });
  });
});
