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
import * as uuid from 'uuid';
import { AgentCommunication } from '../../../communications/agent.communication';
import { Firewall } from '../../../models/firewall/Firewall';
import { Cluster } from '../../../models/firewall/Cluster';
import { CrowdSecInstallationMode } from '../../../models/system/crowdsec/crowdsec-installation.model';
import { CrowdSecInstallationRepository } from '../../../models/system/crowdsec/crowdsec.repository';
import { FirewallRepository } from '../../../models/firewall/firewall.repository';
import { CrowdSecPolicy } from '../../../policies/crowdsec.policy';
import { PgpHelper } from '../../../utils/pgp';
import { Validate } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import db from '../../../database/database-manager';
import { Channel } from '../../../sockets/channels/channel';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import { CrowdSecClusterMachineInstallDto } from './dto/cluster-machine-install.dto';
import { CrowdSecClusterTransitionDto } from './dto/cluster-transition.dto';
import { CentralLapiNode, CrowdSecLapiSharedService } from './crowdsec-lapi-shared.service';

type ClusterMachineNodeResult = {
  firewall_id: number;
  name: string;
  machine_name: string;
  status:
    | 'completed'
    | 'connectivity_confirmation_required'
    | 'pending_connectivity'
    | 'recovery_required'
    | 'failed';
  error?: string;
  central_bouncer_cleanup_required?: boolean;
  central_machine_cleanup_required?: boolean;
  source_machine_removed?: boolean;
  source_bouncer_cleanup_required?: boolean;
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
    const nodes = await this.getAuthorizedNodes(req);

    const lapiService = this.lapiService();
    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    const { centralFirewall, centralLapiNodes } = await this.getExternalCentralLapiTarget(
      req.body.centralFirewallId,
      nodes,
    );
    const channel = await Channel.fromRequest(req);
    const centralLapiProgress = (message: string) =>
      channel.emit('message', new ProgressPayload('info', false, message));
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

    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
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
          return false;
        }
        if (centralLapiAgentAvailable && !centralLapiEnabled) {
          await lapiService.enable(centralLapiNodes);
          centralLapiEnabled = true;
        }
        if (
          CrowdSecLapiSharedService.machineInstallationState(machine) === 'pending_connectivity'
        ) {
          await this.persistMachineNode({
            node,
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
          return true;
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
        await this.persistMachineNode({
          node,
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
      return true;
    });

    if (!completedAllNodes) {
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

  @Validate(CrowdSecClusterTransitionDto)
  public async transitionRole(req: Request): Promise<ResponseBuilder> {
    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }
    if (req.body.mode === CrowdSecInstallationMode.Lapi) {
      return this.transitionNodesToLapi(req);
    }
    if (req.body.mode !== CrowdSecInstallationMode.Machine) {
      throw new HttpException('Invalid CrowdSec cluster role transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req);
    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    const { centralFirewall, centralLapiNodes } = await this.getExternalCentralLapiTarget(
      req.body.centralFirewallId,
      nodes,
    );
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const progress = (message: string) =>
      channel.emit('message', new ProgressPayload('info', false, message));
    await lapiService.preflight(
      centralLapiNodes,
      CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl),
      progress,
    );
    await lapiService.enable(centralLapiNodes);
    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    const results: ClusterMachineNodeResult[] = [];

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Converting CrowdSec cluster nodes to Machines'),
    );
    await this.runSequentialNodeOperations(nodes, async (node) => {
      const machineName = CrowdSecLapiSharedService.machineNameForFirewall(node);
      let transitionId: string | undefined;
      let prepared = false;
      let activated = false;
      let bouncerReplicationStarted = false;
      let recoveryRequired = false;
      try {
        const installation = await new CrowdSecInstallationRepository(
          db.getSource().manager,
        ).findByFirewallId(node.id);
        if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
          throw new HttpException('CrowdSec LAPI installation was not found', 409);
        }
        await lapiService.assertCanBecomeMachine(node);
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend = req.body.localRemediation
          ? ((await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ??
            'iptables')
          : undefined;
        transitionId = uuid.v4();
        const transition = {
          transitionId,
          confirm: true,
          expected: { mode: 'lapi' as const, localRemediation: true },
          target: {
            mode: 'machine' as const,
            localRemediation: req.body.localRemediation,
            machineName,
            lapiUrl,
          },
          authorityChanged: true,
          backend,
        };
        progress(`Converting CrowdSec node '${node.name}' to a Machine`);
        await communication.prepareCrowdSecTransition(transition, channel);
        prepared = true;
        await lapiService.replicateMachineCredentials(
          centralLapiNodes,
          communication,
          machineName,
          progress,
        );
        const bouncerApiKey = req.body.localRemediation
          ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
          : undefined;
        if (bouncerApiKey) {
          bouncerReplicationStarted = true;
          await lapiService.replicateBouncer(
            centralLapiNodes,
            machineName,
            bouncerApiKey,
            progress,
          );
        }
        await communication.activateCrowdSecTransition({ transitionId, bouncerApiKey }, channel);
        activated = true;
        await this.persistMachineNode({
          node,
          centralFirewallId: centralFirewall.id,
          lapiUrl,
          machineName,
          localRemediation: req.body.localRemediation,
        });
        await communication.finalizeCrowdSecTransition(transitionId);
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
        });
      } catch (error) {
        if (prepared && !activated && transitionId) {
          try {
            const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
            await communication.recoverCrowdSecTransition(transitionId);
          } catch {
            recoveryRequired = true;
          }
        }
        const machineCleanup = await lapiService.cleanupMachine(centralLapiNodes, machineName);
        const bouncerCleanup = bouncerReplicationStarted
          ? await lapiService.cleanupBouncer(centralLapiNodes, machineName)
          : undefined;
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: recoveryRequired ? 'recovery_required' : 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec cluster node transition failed',
          ...(!machineCleanup.completed ? { central_machine_cleanup_required: true } : {}),
          ...(bouncerCleanup && !bouncerCleanup.completed
            ? { central_bouncer_cleanup_required: true }
            : {}),
        });
      }
      return true;
    });
    const completed = results.every((result) => result.status === 'completed');
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec Machine transition finished on all cluster nodes'
          : 'CrowdSec Machine transition finished with node failures',
      ),
    );
    return ResponseBuilder.buildResponse().status(200).body({ completed, nodes: results });
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

  private async optionalBouncerApiKey(req: Request, value: unknown): Promise<string | undefined> {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string') {
      throw new HttpException('Invalid CrowdSec Firewall Bouncer API key', 422);
    }
    try {
      const apiKey = (await new PgpHelper(req.session.pgp).decrypt(value)).trim();
      if (
        apiKey.length === 0 ||
        apiKey.length > 512 ||
        Array.from(apiKey).some((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127;
        })
      ) {
        throw new HttpException('Invalid CrowdSec Firewall Bouncer API key', 422);
      }
      return apiKey;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Invalid CrowdSec Firewall Bouncer API key', 422);
    }
  }

  private async transitionNodesToLapi(req: Request): Promise<ResponseBuilder> {
    if (!req.body.localRemediation || req.body.bouncerApiKey !== undefined) {
      throw new HttpException('Invalid CrowdSec cluster role transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req);
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const results: ClusterMachineNodeResult[] = [];

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Restoring CrowdSec LAPI installations in cluster nodes'),
    );
    await this.runSequentialNodeOperations(nodes, async (node) => {
      let transitionId: string | undefined;
      let prepared = false;
      let activated = false;
      let recoveryRequired = false;
      let machineName = '';
      try {
        const installation = await new CrowdSecInstallationRepository(
          db.getSource().manager,
        ).findByFirewallId(node.id);
        if (
          installation?.mode !== CrowdSecInstallationMode.Machine ||
          installation.centralFirewallId === null ||
          installation.machineName === null ||
          installation.lapiUrl === null
        ) {
          throw new HttpException('CrowdSec Machine installation was not found', 409);
        }

        machineName = installation.machineName;
        const machineConnectivityPending = installation.machineConnectivityPending === true;
        const sourceCentralLapiNodes = machineConnectivityPending
          ? undefined
          : await lapiService.getCentralNodes(
              await lapiService.getCentralFirewall(installation.centralFirewallId),
            );
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend =
          (await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ?? 'iptables';
        transitionId = uuid.v4();
        const transition = {
          transitionId,
          confirm: true,
          expected: {
            mode: 'machine' as const,
            localRemediation: machineConnectivityPending ? false : installation.localRemediation,
            machineName: installation.machineName,
            lapiUrl: installation.lapiUrl,
          },
          target: {
            mode: 'lapi' as const,
            localRemediation: true,
          },
          authorityChanged: true,
          backend,
          machineConnectivityPending,
        };

        channel.emit(
          'message',
          new ProgressPayload('info', false, "Restoring CrowdSec LAPI on node '" + node.name + "'"),
        );
        await communication.prepareCrowdSecTransition(transition, channel);
        prepared = true;
        await communication.activateCrowdSecTransition({ transitionId }, channel);
        activated = true;
        await new CrowdSecInstallationRepository(db.getSource().manager).saveLapiInstallation(
          node.id,
        );
        await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(node, true);
        await communication.finalizeCrowdSecTransition(transitionId);

        let sourceMachineRemoved = true;
        if (sourceCentralLapiNodes) {
          const cleanup = await lapiService.cleanupMachine(sourceCentralLapiNodes, machineName);
          sourceMachineRemoved = cleanup.completed;
        }
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
          source_machine_removed: sourceMachineRemoved,
          source_bouncer_cleanup_required:
            !machineConnectivityPending && installation.localRemediation,
        });
      } catch (error) {
        if (prepared && !activated && transitionId) {
          try {
            const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
            await communication.recoverCrowdSecTransition(transitionId);
          } catch {
            recoveryRequired = true;
          }
        }
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: recoveryRequired ? 'recovery_required' : 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec cluster node transition failed',
        });
      }
      return true;
    });

    const completed = results.every((result) => result.status === 'completed');
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec LAPI transition finished on all cluster nodes'
          : 'CrowdSec LAPI transition finished with node failures',
      ),
    );
    return ResponseBuilder.buildResponse().status(200).body({ completed, nodes: results });
  }

  private async persistMachineNode({
    node,
    centralFirewallId,
    lapiUrl,
    machineName,
    localRemediation,
    machineConnectivityPending = false,
  }: {
    node: Firewall;
    centralFirewallId: number;
    lapiUrl: string;
    machineName: string;
    localRemediation: boolean;
    machineConnectivityPending?: boolean;
  }): Promise<void> {
    await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
      node,
      localRemediation,
    );
    await new CrowdSecInstallationRepository(db.getSource().manager).saveMachineInstallation({
      firewallId: node.id,
      centralFirewallId,
      lapiUrl,
      machineName,
      localRemediation,
      ...(machineConnectivityPending ? { machineConnectivityPending: true } : {}),
    });
  }

  private async getExternalCentralLapiTarget(
    centralFirewallId: number,
    nodes: Firewall[],
  ): Promise<{ centralFirewall: Firewall; centralLapiNodes: CentralLapiNode[] }> {
    const lapiService = this.lapiService();
    const centralFirewall = await lapiService.getCentralFirewall(centralFirewallId);
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
    return { centralFirewall, centralLapiNodes };
  }

  private async runSequentialNodeOperations(
    nodes: Firewall[],
    operation: (node: Firewall) => Promise<boolean>,
  ): Promise<boolean> {
    for (const node of nodes) {
      if (!(await operation(node))) {
        return false;
      }
    }
    return true;
  }

  private async getAuthorizedNodes(req: Request): Promise<Firewall[]> {
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
    return nodes;
  }

  private lapiService(): CrowdSecLapiSharedService {
    return new CrowdSecLapiSharedService(db.getSource().manager, this._cluster.fwCloudId);
  }
}
