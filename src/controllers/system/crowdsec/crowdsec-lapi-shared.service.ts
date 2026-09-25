/*!
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { randomBytes } from 'crypto';
import { isIP } from 'net';
import { EntityManager } from 'typeorm';
import { AgentCommunication } from '../../../communications/agent.communication';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../../../models/firewall/Firewall';
import { CrowdSecInstallationMode } from '../../../models/system/crowdsec/crowdsec-installation.model';
import { CrowdSecInstallationRepository } from '../../../models/system/crowdsec/crowdsec.repository';

export type CentralLapiNode = {
  firewall: Firewall;
  communication: AgentCommunication;
};

export type CentralLapiCleanup = {
  completed: boolean;
  nodes: Array<{
    firewall_id: number;
    cleaned: boolean;
  }>;
};

export class CrowdSecLapiSharedService {
  private installationRepository: CrowdSecInstallationRepository;

  constructor(
    private manager: EntityManager,
    private fwCloudId: number,
  ) {
    this.installationRepository = new CrowdSecInstallationRepository(manager);
  }

  async getCentralFirewall(id: number): Promise<Firewall> {
    const firewall = await this.manager.getRepository(Firewall).findOne({
      where: { id, fwCloudId: this.fwCloudId },
    });
    if (!firewall) {
      throw new HttpException('Central CrowdSec firewall was not found', 404);
    }
    const installation = await this.installationRepository.findByFirewallId(firewall.id);
    if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
      throw new HttpException(
        'Central CrowdSec firewall requires a LAPI CrowdSec installation',
        409,
      );
    }
    return firewall;
  }

  async getCentralNodes(centralFirewall: Firewall): Promise<CentralLapiNode[]> {
    const firewalls =
      centralFirewall.clusterId === null || centralFirewall.clusterId === undefined
        ? [centralFirewall]
        : await this.manager.getRepository(Firewall).find({
            where: { clusterId: centralFirewall.clusterId, fwCloudId: this.fwCloudId },
          });
    if (firewalls.length === 0) {
      throw new HttpException('Central CrowdSec LAPI cluster has no firewall nodes', 409);
    }

    const nodes: CentralLapiNode[] = [];
    for (const firewall of [...firewalls].sort((first, second) => first.id - second.id)) {
      const installation = await this.installationRepository.findByFirewallId(firewall.id);
      if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
        throw new HttpException(
          'Every central CrowdSec cluster node requires a LAPI CrowdSec installation',
          409,
        );
      }
      nodes.push({
        firewall,
        communication: await CrowdSecLapiSharedService.agentCommunication(firewall, true),
      });
    }
    return nodes;
  }

  async assertCanBecomeMachine(firewall: Firewall, rejectExistingMachine = false): Promise<void> {
    const installation = await this.installationRepository.findByFirewallId(firewall.id);
    if (rejectExistingMachine && installation?.mode === CrowdSecInstallationMode.Machine) {
      throw new HttpException('CrowdSec Machine installation already exists on this node', 409);
    }
    if (
      installation?.mode === CrowdSecInstallationMode.Lapi &&
      (await this.installationRepository.hasMachineDependents(firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec LAPI has dependent machines and cannot be converted to a Machine',
        409,
      );
    }
  }

  async preflight(nodes: CentralLapiNode[], listenUri: string): Promise<void> {
    for (const node of nodes) {
      await node.communication.ping();
      await node.communication.getCrowdSecLapiReplicationReadiness();
    }
    for (const node of nodes) {
      await node.communication.configureCrowdSecCentralLapi(listenUri);
    }
  }

  async enable(nodes: CentralLapiNode[]): Promise<void> {
    for (const node of nodes) {
      await this.installationRepository.setCentralLapiEnabled(node.firewall.id, true);
    }
  }

  async replicateMachineCredentials(
    nodes: CentralLapiNode[],
    remoteCommunication: AgentCommunication,
    machineName: string,
  ): Promise<Record<string, unknown>[]> {
    const credentials = await remoteCommunication.exportCrowdSecMachineCredentials(machineName);
    if (credentials.login !== machineName || credentials.password.length === 0) {
      throw new HttpException('Unable to export CrowdSec Machine credentials', 502);
    }

    const replicatedNodes: Record<string, unknown>[] = [];
    for (const node of nodes) {
      replicatedNodes.push({
        firewall_id: node.firewall.id,
        replication: await node.communication.replicateCrowdSecLapiMachine(
          credentials.login,
          credentials.password,
        ),
      });
    }
    return replicatedNodes;
  }

  async replicateBouncer(
    nodes: CentralLapiNode[],
    name: string,
    apiKey: string,
  ): Promise<Record<string, unknown>[]> {
    const replicatedNodes: Record<string, unknown>[] = [];
    for (const node of nodes) {
      replicatedNodes.push({
        firewall_id: node.firewall.id,
        replication: await node.communication.replicateCrowdSecLapiBouncer(name, apiKey),
      });
    }
    return replicatedNodes;
  }

  static generateBouncerApiKey(): string {
    return randomBytes(32).toString('hex');
  }

  async cleanupMachine(nodes: CentralLapiNode[], name: string): Promise<CentralLapiCleanup> {
    return this.cleanup(nodes, (node) => node.communication.removeCrowdSecLapiMachine(name));
  }

  async cleanupBouncer(nodes: CentralLapiNode[], name: string): Promise<CentralLapiCleanup> {
    return this.cleanup(nodes, (node) => node.communication.removeCrowdSecBouncer(name));
  }

  private async cleanup(
    nodes: CentralLapiNode[],
    operation: (node: CentralLapiNode) => Promise<Record<string, unknown>>,
  ): Promise<CentralLapiCleanup> {
    const cleanupNodes: CentralLapiCleanup['nodes'] = [];
    for (const node of nodes) {
      try {
        await operation(node);
        cleanupNodes.push({ firewall_id: node.firewall.id, cleaned: true });
      } catch {
        cleanupNodes.push({ firewall_id: node.firewall.id, cleaned: false });
      }
    }
    return {
      completed: cleanupNodes.every((node) => node.cleaned),
      nodes: cleanupNodes,
    };
  }

  static primaryNode(nodes: CentralLapiNode[], firewallId: number): CentralLapiNode {
    const node = nodes.find((candidate) => candidate.firewall.id === firewallId);
    if (!node) {
      throw new HttpException('Central CrowdSec LAPI node was not found', 409);
    }
    return node;
  }

  static async agentCommunication(
    firewall: Firewall,
    central: boolean,
  ): Promise<AgentCommunication> {
    if (
      firewall.install_communication !== FirewallInstallCommunication.Agent ||
      (central && firewall.install_protocol !== FirewallInstallProtocol.HTTPS)
    ) {
      throw new HttpException(
        central
          ? 'Central CrowdSec LAPI requires HTTPS FWCloud Agent communication'
          : 'CrowdSec requires FWCloud Agent communication',
        409,
      );
    }
    const communication = await firewall.getCommunication();
    if (!(communication instanceof AgentCommunication)) {
      throw new HttpException(
        central
          ? 'Central CrowdSec LAPI requires HTTPS FWCloud Agent communication'
          : 'CrowdSec requires FWCloud Agent communication',
        409,
      );
    }
    return communication;
  }

  static machineName(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value)) {
      throw new HttpException('Invalid CrowdSec machine name', 400);
    }
    return value;
  }

  static machineNameForFirewall(firewall: Firewall): string {
    const name = firewall.name
      .replace(/[^A-Za-z0-9_.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const prefix = 'fwcloud-';
    return `${prefix}${(name || 'node').slice(0, 128 - prefix.length)}`;
  }

  static machineInstallationState(machine: Record<string, unknown>): string | undefined {
    return typeof machine.installation_state === 'string' ? machine.installation_state : undefined;
  }

  static lapiUrl(value: unknown): string {
    if (typeof value !== 'string') {
      throw new HttpException('Invalid CrowdSec Local API URL', 400);
    }
    try {
      const url = new URL(value);
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        isIP(url.hostname.replace(/^\[|\]$/g, '')) === 0 ||
        url.port.length === 0 ||
        url.username.length > 0 ||
        url.password.length > 0 ||
        (url.pathname !== '' && url.pathname !== '/') ||
        url.search.length > 0 ||
        url.hash.length > 0
      ) {
        throw new Error('Invalid CrowdSec Local API URL');
      }
      return url.toString().replace(/\/$/, '');
    } catch {
      throw new HttpException('Invalid CrowdSec Local API URL', 400);
    }
  }

  static listenerUriForLapiUrl(lapiUrl: string): string {
    const url = new URL(lapiUrl);
    const host = isIP(url.hostname.replace(/^\[|\]$/g, '')) === 6 ? '[::]' : '0.0.0.0';
    return `${host}:${url.port}`;
  }

  static bouncerApiKey(response: Record<string, unknown>): string {
    if (typeof response.api_key !== 'string' || response.api_key.length === 0) {
      throw new HttpException('Unable to create CrowdSec Firewall Bouncer API key', 502);
    }
    return response.api_key;
  }
}
