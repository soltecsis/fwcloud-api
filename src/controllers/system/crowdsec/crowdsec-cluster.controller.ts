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

import { Request } from 'express';
import { isIP } from 'net';
import { AgentCommunication } from '../../../communications/agent.communication';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../../../models/firewall/Firewall';
import { Cluster } from '../../../models/firewall/Cluster';
import { CrowdSecInstallationMode } from '../../../models/system/crowdsec/crowdsec-installation.model';
import { CrowdSecInstallationRepository } from '../../../models/system/crowdsec/crowdsec.repository';
import { FirewallRepository } from '../../../models/firewall/firewall.repository';
import { CrowdSecPolicy } from '../../../policies/crowdsec.policy';
import { Validate } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import db from '../../../database/database-manager';
import { Channel } from '../../../sockets/channels/channel';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import { CrowdSecClusterMachineInstallDto } from './dto/cluster-machine-install.dto';

type ClusterMachineNodeResult = {
  firewall_id: number;
  name: string;
  machine_name: string;
  status: 'completed' | 'connectivity_confirmation_required' | 'pending_connectivity' | 'failed';
  error?: string;
  central_bouncer_cleanup_required?: boolean;
};

export class CrowdSecClusterController extends Controller {
  private _cluster: Cluster;

  public async make(request: Request): Promise<void> {
    const clusterId = Number(request.params.cluster);
    const fwcloudId = Number(request.params.fwcloud);
    if (
      !Number.isInteger(clusterId) ||
      clusterId < 1 ||
      !Number.isInteger(fwcloudId) ||
      fwcloudId < 1
    ) {
      throw new HttpException('Invalid cluster context', 400);
    }

    const cluster = await db
      .getSource()
      .manager.getRepository(Cluster)
      .findOne({
        where: { id: clusterId, fwCloudId: fwcloudId },
        relations: ['firewalls'],
      });
    if (!cluster) {
      throw new HttpException('Cluster was not found', 404);
    }
    this._cluster = cluster;
  }

  @Validate(CrowdSecClusterMachineInstallDto)
  public async installMachine(req: Request): Promise<ResponseBuilder> {
    const nodes = [...this._cluster.firewalls].sort((first, second) => first.id - second.id);
    if (nodes.length === 0) {
      throw new HttpException('CrowdSec cluster has no firewall nodes', 409);
    }
    for (const node of nodes) {
      (await CrowdSecPolicy.manage(node, req.session.user)).authorize();
    }

    const lapiUrl = this.lapiUrl(req.body.lapiUrl);
    const centralFirewall = await this.centralFirewall(req.body.centralFirewallId);
    if (nodes.some((node) => node.id === centralFirewall.id)) {
      throw new HttpException(
        'CrowdSec Machine nodes must use an external central LAPI firewall',
        422,
      );
    }
    const centralCommunication = await this.agentCommunication(centralFirewall, true);
    const channel = await Channel.fromRequest(req);
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Installing CrowdSec Machines in cluster nodes'),
    );
    const results: ClusterMachineNodeResult[] = [];
    let centralLapiAgentAvailable = true;
    try {
      await centralCommunication.ping();
      await centralCommunication.configureCrowdSecCentralLapi(this.listenerUriForLapiUrl(lapiUrl));
    } catch {
      centralLapiAgentAvailable = false;
      if (req.body.continueWithoutLapiConnectivity !== true) {
        const firstNode = nodes[0];
        results.push({
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: this.machineName(firstNode),
          status: 'connectivity_confirmation_required',
        });
        channel.emit(
          'message',
          new ProgressPayload(
            'warning',
            false,
            'CrowdSec Machine installation requires confirmation because the central Local API agent is unreachable',
          ),
        );
        channel.emit(
          'message',
          new ProgressPayload(
            'end',
            false,
            'CrowdSec Machine installation is awaiting confirmation',
          ),
        );
        return ResponseBuilder.buildResponse().status(200).body({
          completed: false,
          connectivity_confirmation_required: true,
          connectivity_confirmation_reason: 'central_agent_unreachable',
          nodes: results,
        });
      }
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'Central CrowdSec Local API agent is unreachable; continuing without central configuration or registration',
        ),
      );
    }
    let centralLapiEnabled = false;

    for (const node of nodes) {
      const machineName = this.machineName(node);
      let centralBouncerCleanupRequired = false;
      channel.emit(
        'message',
        new ProgressPayload('info', false, `Installing CrowdSec Machine on node '${node.name}'`),
      );
      try {
        await this.assertCanBecomeMachine(node, installationRepository);
        const remoteCommunication = await this.agentCommunication(node, false);
        const machine = await remoteCommunication.installCrowdSecMachine(
          {
            machineName,
            lapiUrl,
            ...(req.body.continueWithoutLapiConnectivity === true
              ? { continueWithoutLapiConnectivity: true }
              : {}),
          },
          channel,
        );
        if (this.machineInstallationState(machine) === 'connectivity_confirmation_required') {
          results.push({
            firewall_id: node.id,
            name: node.name,
            machine_name: machineName,
            status: 'connectivity_confirmation_required',
          });
          channel.emit(
            'message',
            new ProgressPayload(
              'end',
              false,
              'CrowdSec Machine installation requires confirmation because the central Local API is unreachable',
            ),
          );
          return ResponseBuilder.buildResponse().status(200).body({
            completed: false,
            connectivity_confirmation_required: true,
            nodes: results,
          });
        }
        if (centralLapiAgentAvailable && !centralLapiEnabled) {
          await installationRepository.setCentralLapiEnabled(centralFirewall.id, true);
          centralLapiEnabled = true;
        }
        if (this.machineInstallationState(machine) === 'pending_connectivity') {
          await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(node, true);
          await installationRepository.saveMachineInstallation({
            firewallId: node.id,
            centralFirewallId: centralFirewall.id,
            lapiUrl,
            machineName,
            localRemediation: req.body.localRemediation,
            machineConnectivityPending: true,
          });
          results.push({
            firewall_id: node.id,
            name: node.name,
            machine_name: machineName,
            status: 'pending_connectivity',
          });
          channel.emit(
            'message',
            new ProgressPayload(
              'warning',
              false,
              `CrowdSec Machine installation on node '${node.name}' is pending central Local API connectivity`,
            ),
          );
          continue;
        }
        await centralCommunication.validateCrowdSecLapiMachine(machineName);
        const backend =
          (await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ?? 'iptables';
        let bouncerApiKey: string | undefined;
        if (req.body.localRemediation) {
          bouncerApiKey = this.bouncerApiKey(
            await centralCommunication.registerCrowdSecBouncer(machineName),
          );
          centralBouncerCleanupRequired = true;
        }
        await remoteCommunication.activateCrowdSecMachine(
          {
            machineName,
            localRemediation: req.body.localRemediation,
            backend,
            bouncerApiKey,
          },
          channel,
        );
        await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(node, true);
        await installationRepository.saveMachineInstallation({
          firewallId: node.id,
          centralFirewallId: centralFirewall.id,
          lapiUrl,
          machineName,
          localRemediation: req.body.localRemediation,
        });
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
        });
        channel.emit(
          'message',
          new ProgressPayload(
            'success',
            false,
            `CrowdSec Machine installation finished on node '${node.name}'`,
          ),
        );
      } catch (error) {
        try {
          await centralCommunication.removeCrowdSecLapiMachine(machineName);
        } catch {
          // Preserve the original node failure; the central LAPI may require manual cleanup.
        }
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec Machine installation failed',
          ...(centralBouncerCleanupRequired ? { central_bouncer_cleanup_required: true } : {}),
        });
        if (centralBouncerCleanupRequired) {
          channel.emit(
            'message',
            new ProgressPayload(
              'warning',
              false,
              `Remove the CrowdSec Firewall Bouncer '${machineName}' manually from the central Local API`,
            ),
          );
        }
        channel.emit(
          'message',
          new ProgressPayload(
            'error',
            false,
            `CrowdSec Machine installation failed on node '${node.name}'`,
          ),
        );
      }
    }

    const completed = results.every((result) => result.status === 'completed');
    const pendingConnectivity = results.some((result) => result.status === 'pending_connectivity');
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec Machine installation finished on all cluster nodes'
          : pendingConnectivity
            ? 'CrowdSec Machine installation is pending central Local API connectivity'
            : 'CrowdSec Machine installation finished with node failures',
      ),
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        ...(pendingConnectivity ? { pending_connectivity: true } : {}),
        nodes: results,
      });
  }

  @Validate()
  public async collections(req: Request): Promise<ResponseBuilder> {
    const nodes = [...this._cluster.firewalls].sort((first, second) => first.id - second.id);
    for (const node of nodes) {
      (await CrowdSecPolicy.view(node, req.session.user)).authorize();
    }

    const collections = await Promise.all(
      nodes.map(async (node) => {
        try {
          return {
            firewall_id: node.id,
            name: node.name,
            collections: await (
              await this.agentCommunication(node, false)
            ).getCrowdSecCollections(),
          };
        } catch (error) {
          return {
            firewall_id: node.id,
            name: node.name,
            error: error instanceof Error ? error.message : 'Unable to load CrowdSec collections',
          };
        }
      }),
    );

    return ResponseBuilder.buildResponse().status(200).body({ nodes: collections });
  }

  private async centralFirewall(id: number): Promise<Firewall> {
    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id, fwCloudId: this._cluster.fwCloudId },
      });
    if (!firewall) {
      throw new HttpException('Central CrowdSec firewall was not found', 404);
    }
    const installation = await new CrowdSecInstallationRepository(
      db.getSource().manager,
    ).findByFirewallId(firewall.id);
    if (installation?.mode !== CrowdSecInstallationMode.Standalone) {
      throw new HttpException(
        'Central CrowdSec firewall requires a standalone CrowdSec installation',
        409,
      );
    }
    return firewall;
  }

  private async assertCanBecomeMachine(
    firewall: Firewall,
    installations: CrowdSecInstallationRepository,
  ): Promise<void> {
    const installation = await installations.findByFirewallId(firewall.id);
    if (installation?.mode === CrowdSecInstallationMode.Machine) {
      throw new HttpException('CrowdSec Machine installation already exists on this node', 409);
    }
    if (
      installation?.mode === CrowdSecInstallationMode.Standalone &&
      (await installations.hasMachineDependents(firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec standalone Local API has dependent machines and cannot be converted to a Machine',
        409,
      );
    }
  }

  private async agentCommunication(
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

  private machineName(firewall: Firewall): string {
    const name = firewall.name
      .replace(/[^A-Za-z0-9_.-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    const prefix = 'fwcloud-';
    const availableNameLength = 128 - prefix.length;
    return `${prefix}${(name || 'node').slice(0, availableNameLength)}`;
  }

  private machineInstallationState(machine: Record<string, unknown>): string | undefined {
    return typeof machine.installation_state === 'string' ? machine.installation_state : undefined;
  }

  private lapiUrl(value: unknown): string {
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

  private listenerUriForLapiUrl(lapiUrl: string): string {
    const url = new URL(lapiUrl);
    const host = isIP(url.hostname.replace(/^\[|\]$/g, '')) === 6 ? '[::]' : '0.0.0.0';
    return `${host}:${url.port}`;
  }

  private bouncerApiKey(response: Record<string, unknown>): string {
    if (typeof response.api_key !== 'string' || response.api_key.length === 0) {
      throw new HttpException('Unable to create CrowdSec Firewall Bouncer API key', 502);
    }
    return response.api_key;
  }
}
