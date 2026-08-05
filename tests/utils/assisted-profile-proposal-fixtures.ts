import {
  AssistantContractCustoms,
  type ValidatedAssistedProfileProposal,
} from '../../src/models/assistant-contract/assistant-contract-customs';
import validSuccess from '../Unit/models/assistant-contract/fixtures/valid-success.json';

type TargetKind = 'firewall' | 'cluster';

/**
 * Puts a fixture through the real API-1 contract gate, as production does.
 * Anything downstream of the gate (the mapper, drafts, preview) may only ever
 * be handed a payload that actually passed it.
 */
export function validateAssistedProfileFixtureAtGateway(
  payload: Record<string, unknown>,
): ValidatedAssistedProfileProposal {
  const result = new AssistantContractCustoms().check(payload);

  if (result.ok === false) {
    throw new Error(`Assisted Profile fixture did not pass the contract gate: ${result.message}`);
  }

  return result.payload;
}

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
