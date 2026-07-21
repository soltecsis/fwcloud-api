import validSuccess from '../Unit/models/assistant-contract/fixtures/valid-success.json';

type TargetKind = 'firewall' | 'cluster';

interface FixtureOptions {
  targetKind?: TargetKind;
  dmz?: boolean;
  includeSync?: boolean;
  schemaVersion?: string;
}

/**
 * Builds mapping fixtures from API-1's canonical success envelope so tests do
 * not duplicate the large contract payload.
 */
export function makeAssistedProfileProposalFixture({
  targetKind = 'firewall',
  dmz = false,
  includeSync = targetKind === 'cluster',
  schemaVersion = '1.0.0',
}: FixtureOptions = {}): Record<string, unknown> {
  const fixture = structuredClone(validSuccess) as Record<string, any>;
  const cluster = targetKind === 'cluster';
  const interfaces: Array<Record<string, unknown>> = [
    { name: 'wan0', role: 'wan', address: null, description: null, node: null },
    { name: 'lan0', role: 'lan', address: null, description: null, node: null },
  ];

  if (dmz) {
    interfaces.push({ name: 'dmz0', role: 'dmz', address: null, description: null, node: null });
  }
  if (includeSync) {
    interfaces.push({
      name: 'sync0',
      role: 'sync',
      address: null,
      description: 'Cluster synchronization',
      node: 'node-a',
    });
  }

  fixture.intent.detectedTarget = targetKind;
  fixture.metadata.schemaVersion = schemaVersion;
  fixture.generated = {
    profile: {
      code: cluster ? 'assisted-cluster' : 'assisted-firewall',
      description: cluster ? 'Assisted cluster profile' : 'Assisted firewall profile',
      name: cluster ? 'Assisted cluster' : 'Assisted firewall',
      requiredRoles: interfaces.map((item) => item.role),
      targetTypes: [targetKind],
      version: 1,
    },
    roleAssignments: {
      interfaceRoles: interfaces.map((item) => ({
        interfaceName: item.name,
        role: item.role,
        node: item.node,
      })),
      nodeRoles: cluster
        ? [
            { nodeName: 'node-a', role: 'primary' },
            { nodeName: 'node-b', role: 'secondary' },
          ]
        : [],
    },
    target: {
      type: targetKind,
      name: cluster ? 'edge-cluster' : 'edge-firewall',
      interfaces,
      nodes: cluster
        ? [
            { name: 'node-a', role: 'primary' },
            { name: 'node-b', role: 'secondary' },
          ]
        : [],
    },
    rules: [
      {
        action: 'allow',
        sourceRole: 'lan',
        destinationRole: 'wan',
        service: 'tcp/443',
        description: 'Allow outbound HTTPS',
      },
      ...(dmz
        ? [
            {
              action: 'allow',
              sourceRole: 'wan',
              destinationRole: 'dmz',
              service: 'tcp/443',
              description: 'Publish HTTPS to the DMZ',
            },
          ]
        : []),
    ],
  };

  return fixture;
}
