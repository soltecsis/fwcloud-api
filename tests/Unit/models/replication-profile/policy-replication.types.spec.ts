import { describeName, expect } from '../../../mocha/global-setup';
import { getProfileProvisioning } from '../../../../src/models/replication-profile/policy-replication.types';

/** Blocks every parsed provision carries even when the profile does not declare them. */
const EMPTY_BLOCKS = {
  routing: { tables: [], rules: [] },
  system: { dhcp: [], keepalived: [], haproxy: [] },
};
const NO_TRANSLATION = { translatedSource: [], translatedDestination: [], translatedServices: [] };

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
        { name: 'WAN', role: 'WAN', addresses: [] },
        { name: 'LAN', role: 'LAN', addresses: [] },
      ],
      rules: [
        {
          chain: 'forward',
          ipVersion: 4,
          action: 'accept',
          inRoles: ['LAN'],
          outRoles: ['WAN'],
          source: [],
          destination: [],
          services: [{ protocol: 'tcp', port: 443 }],
          ...NO_TRANSLATION,
          comment: 'Allow LAN to WAN HTTPS',
        },
      ],
      ...EMPTY_BLOCKS,
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
      interfaces: [{ name: 'Office LAN', role: 'office-lan', addresses: [] }],
      rules: [
        {
          chain: 'forward',
          ipVersion: 4,
          action: 'deny',
          inRoles: ['office-lan'],
          outRoles: [],
          source: [],
          destination: [],
          services: [{ protocol: 'udp', port: 53 }],
          ...NO_TRANSLATION,
          comment: undefined,
        },
      ],
      ...EMPTY_BLOCKS,
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
    ).to.deep.equal({ interfaces: [], rules: [], ...EMPTY_BLOCKS });
  });
});
