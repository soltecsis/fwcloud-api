import { EventEmitter } from 'events';
import {
  Communication,
  PolicyInstallationBackup,
  PolicyInstallationError,
  PolicyRecoveryStatus,
} from './communication';
import { ProgressErrorPayload, ProgressInfoPayload } from '../sockets/messages/socket-message';

export type ClusterPolicyNode = {
  firewallId: number;
  communication: Communication<unknown>;
};

export type ClusterPolicyNodeResult = {
  firewallId: number;
  installation: 'pending' | 'installed' | 'failed' | 'unknown';
  recovery: 'not_needed' | PolicyRecoveryStatus;
};

export type ClusterPolicyResult = {
  success: boolean;
  nodes: ClusterPolicyNodeResult[];
};

function backupName(): string {
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, '')
    .slice(0, 14);
  return `fwcloud-${timestamp}.sh`;
}

export async function installClusterPolicy(
  nodes: ClusterPolicyNode[],
  scriptPath: string,
  events: EventEmitter = new EventEmitter(),
): Promise<ClusterPolicyResult> {
  if (!nodes.length || new Set(nodes.map((node) => node.firewallId)).size !== nodes.length) {
    throw new Error('A cluster installation requires unique nodes');
  }
  const results: ClusterPolicyNodeResult[] = nodes.map(({ firewallId }) => ({
    firewallId,
    installation: 'pending',
    recovery: 'not_needed',
  }));
  const installed: Array<{
    node: ClusterPolicyNode;
    result: ClusterPolicyNodeResult;
    backup: PolicyInstallationBackup | null;
  }> = [];

  for (let index = 0; index < nodes.length; index++) {
    const node = nodes[index];
    const result = results[index];
    events.emit(
      'message',
      new ProgressInfoPayload(`Installing firewall policy on node ${node.firewallId}.`),
    );
    try {
      const backup = await node.communication.installCoordinatedFirewallPolicy(
        scriptPath,
        backupName(),
        events,
      );
      result.installation = 'installed';
      installed.push({ node, result, backup });
    } catch (error) {
      result.installation =
        error instanceof PolicyInstallationError && error.recoveryStatus !== 'unknown'
          ? 'failed'
          : 'unknown';
      result.recovery = error instanceof PolicyInstallationError ? error.recoveryStatus : 'unknown';
      events.emit(
        'message',
        new ProgressErrorPayload(`Firewall policy installation failed on node ${node.firewallId}.`),
      );

      for (const previous of installed) {
        if (!previous.backup) {
          previous.result.recovery = 'unavailable';
          continue;
        }
        events.emit(
          'message',
          new ProgressInfoPayload(
            `Restoring previous firewall policy on node ${previous.node.firewallId}.`,
          ),
        );
        try {
          await previous.node.communication.recoverFirewallPolicy(previous.backup, events);
          previous.result.recovery = 'restored';
        } catch {
          previous.result.recovery = 'unknown';
          events.emit(
            'message',
            new ProgressErrorPayload(
              `Firewall policy recovery could not be confirmed on node ${previous.node.firewallId}.`,
            ),
          );
        }
      }
      return { success: false, nodes: results };
    }
  }

  return { success: true, nodes: results };
}
