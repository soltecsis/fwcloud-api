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
import { AgentCommunication } from '../../../communications/agent.communication';
import { Firewall } from '../../../models/firewall/Firewall';
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
import { CrowdSecLapiSharedService } from './crowdsec-lapi-shared.service';

type ClusterMachineNodeResult = {
  firewall_id: number;
  name: string;
  machine_name: string;
  status: 'completed' | 'connectivity_confirmation_required' | 'pending_connectivity' | 'failed';
  error?: string;
  central_bouncer_cleanup_required?: boolean;
  central_machine_cleanup_required?: boolean;
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
    const clusterNodes = [...this._cluster.firewalls].sort((first, second) => first.id - second.id);
    const requestedNodeIds = req.body.nodeIds as number[] | undefined;
    const requestedNodeIdsSet = requestedNodeIds ? new Set(requestedNodeIds) : undefined;
    const nodes = requestedNodeIdsSet
      ? clusterNodes.filter((node) => requestedNodeIdsSet.has(node.id))
      : clusterNodes;
    if (nodes.length === 0) {
      throw new HttpException(
        requestedNodeIdsSet
          ? 'Selected CrowdSec cluster nodes were not found'
          : 'CrowdSec cluster has no firewall nodes',
        409,
      );
    }
    if (requestedNodeIdsSet && nodes.length !== requestedNodeIdsSet.size) {
      throw new HttpException('Selected CrowdSec nodes do not belong to this cluster', 422);
    }
    for (const node of nodes) {
      (await CrowdSecPolicy.manage(node, req.session.user)).authorize();
    }

    const lapiService = this.lapiService();
    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    const centralFirewall = await lapiService.getCentralFirewall(req.body.centralFirewallId);
    const centralLapiNodes = await lapiService.getCentralNodes(centralFirewall);
    if (
      nodes.some((node) =>
        centralLapiNodes.some((centralNode) => centralNode.firewall.id === node.id),
      )
    ) {
      throw new HttpException(
        'CrowdSec Machine nodes must use an external central LAPI firewall',
        422,
      );
    }
    const channel = await Channel.fromRequest(req);
    const centralLapiProgress = (message: string) =>
      channel.emit('message', new ProgressPayload('info', false, message));
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Installing CrowdSec Machines in cluster nodes'),
    );
    const results: ClusterMachineNodeResult[] = [];
    let centralLapiAgentAvailable = true;
    try {
      await lapiService.preflight(
        centralLapiNodes,
        CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl),
        centralLapiProgress,
      );
    } catch {
      centralLapiAgentAvailable = false;
      if (req.body.continueWithoutLapiConnectivity !== true) {
        const firstNode = nodes[0];
        results.push({
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: CrowdSecLapiSharedService.machineNameForFirewall(firstNode),
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
      const machineName = CrowdSecLapiSharedService.machineNameForFirewall(node);
      let bouncerReplicationStarted = false;
      channel.emit(
        'message',
        new ProgressPayload('info', false, `Installing CrowdSec Machine on node '${node.name}'`),
      );
      try {
        await lapiService.assertCanBecomeMachine(node, true);
        const remoteCommunication = await CrowdSecLapiSharedService.agentCommunication(node, false);
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
        if (
          CrowdSecLapiSharedService.machineInstallationState(machine) ===
          'connectivity_confirmation_required'
        ) {
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
          return ResponseBuilder.buildResponse()
            .status(200)
            .body({
              completed: false,
              connectivity_confirmation_required: true,
              central_lapi_nodes: centralLapiAgentAvailable
                ? centralLapiNodes.map((node) => ({
                    firewall_id: node.firewall.id,
                    name: node.firewall.name,
                  }))
                : [],
              nodes: results,
            });
        }
        if (centralLapiAgentAvailable && !centralLapiEnabled) {
          await lapiService.enable(centralLapiNodes);
          centralLapiEnabled = true;
        }
        if (
          CrowdSecLapiSharedService.machineInstallationState(machine) === 'pending_connectivity'
        ) {
          await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
            node,
            req.body.localRemediation,
          );
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
        await lapiService.replicateMachineCredentials(
          centralLapiNodes,
          remoteCommunication,
          machineName,
          centralLapiProgress,
        );
        const backend =
          (await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ?? 'iptables';
        let bouncerApiKey: string | undefined;
        if (req.body.localRemediation) {
          bouncerApiKey = CrowdSecLapiSharedService.generateBouncerApiKey();
          bouncerReplicationStarted = true;
          await lapiService.replicateBouncer(
            centralLapiNodes,
            machineName,
            bouncerApiKey,
            centralLapiProgress,
          );
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
        await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
          node,
          req.body.localRemediation,
        );
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
            'CrowdSec Machine installation finished on node ' + node.name,
          ),
        );
      } catch (error) {
        const machineCleanup = await lapiService.cleanupMachine(centralLapiNodes, machineName);
        const bouncerCleanup = bouncerReplicationStarted
          ? await lapiService.cleanupBouncer(centralLapiNodes, machineName)
          : undefined;
        const centralMachineCleanupRequired = !machineCleanup.completed;
        const centralBouncerCleanupRequired =
          bouncerCleanup !== undefined && !bouncerCleanup.completed;
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec Machine installation failed',
          ...(centralMachineCleanupRequired ? { central_machine_cleanup_required: true } : {}),
          ...(centralBouncerCleanupRequired ? { central_bouncer_cleanup_required: true } : {}),
        });
        if (centralMachineCleanupRequired || centralBouncerCleanupRequired) {
          channel.emit(
            'message',
            new ProgressPayload(
              'warning',
              false,
              'CrowdSec central Local API cleanup is incomplete and must be retried manually',
            ),
          );
        }
        channel.emit(
          'message',
          new ProgressPayload(
            'error',
            false,
            'CrowdSec Machine installation failed on node ' + node.name,
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
        central_lapi_nodes: centralLapiAgentAvailable
          ? centralLapiNodes.map((node) => ({
              firewall_id: node.firewall.id,
              name: node.firewall.name,
            }))
          : [],
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
              await CrowdSecLapiSharedService.agentCommunication(node, false)
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

  private lapiService(): CrowdSecLapiSharedService {
    return new CrowdSecLapiSharedService(db.getSource().manager, this._cluster.fwCloudId);
  }
}
