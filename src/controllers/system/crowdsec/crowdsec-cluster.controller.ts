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
import { Firewall, FireWallOptMask } from '../../../models/firewall/Firewall';
import { Cluster } from '../../../models/firewall/Cluster';
import {
  CrowdSecInstallation,
  CrowdSecInstallationMode,
} from '../../../models/system/crowdsec/crowdsec-installation.model';
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

type ClusterCrowdSecInstallationSnapshot = Pick<
  CrowdSecInstallation,
  | 'mode'
  | 'centralFirewallId'
  | 'lapiUrl'
  | 'machineName'
  | 'localRemediation'
  | 'machineConnectivityPending'
  | 'centralLapiEnabled'
  | 'consoleEnrollmentConfirmed'
>;

type ClusterCrowdSecNodeSnapshot = {
  firewallId: number;
  crowdsecCompatibility: boolean;
  installation: ClusterCrowdSecInstallationSnapshot | null;
};

type ClusterTransitionAttempt = {
  node: Firewall;
  transitionId: string;
};

type ClusterMachineNodeResult = {
  firewall_id: number;
  name: string;
  machine_name: string;
  status:
    | 'completed'
    | 'connectivity_confirmation_required'
    | 'pending_connectivity'
    | 'recovery_required'
    | 'failed'
    | 'cancelled'
    | 'rolled_back'
    | 'rollback_failed'
    | 'finalization_failed';
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
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId === undefined ||
      req.body.lapiUrl === undefined
    ) {
      throw new HttpException('Invalid CrowdSec cluster role transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req, false);
    const initialNodeStates = await this.captureInitialNodeStates(nodes);
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
    const transitionAttempts: ClusterTransitionAttempt[] = [];

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Converting CrowdSec cluster nodes to Machines'),
    );
    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
      this.requireInitialNodeState(initialNodeStates, node);
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
        transitionAttempts.push({ node, transitionId });
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
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
        });
        return true;
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
      return false;
    });
    if (!completedAllNodes) {
      await this.rollbackClusterTransitions(transitionAttempts, initialNodeStates, results);
      this.appendCancelledNodeResults(nodes, results, initialNodeStates);
    }
    const finalizationCompleted = completedAllNodes
      ? await this.finalizeClusterTransitions(transitionAttempts, results)
      : true;
    const completed = results.every(
      (result) => result.status === 'completed' || result.status === 'finalization_failed',
    );
    if (!finalizationCompleted) {
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'CrowdSec transition is active, but one or more nodes require finalization confirmation',
        ),
      );
    }
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
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        ...(!finalizationCompleted ? { finalization_incomplete: true } : {}),
        nodes: results,
      });
  }

  @Validate(CrowdSecClusterTransitionDto)
  public async transitionMachineCentralLapi(req: Request): Promise<ResponseBuilder> {
    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId === undefined ||
      req.body.lapiUrl === undefined
    ) {
      throw new HttpException('Invalid CrowdSec cluster central LAPI transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req, false);
    const initialNodeStates = await this.captureInitialNodeStates(nodes);
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
    const transitionAttempts: ClusterTransitionAttempt[] = [];

    channel.emit(
      'message',
      new ProgressPayload(
        'start',
        false,
        'Moving CrowdSec Machine cluster nodes to a new Local API',
      ),
    );
    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
      this.requireInitialNodeState(initialNodeStates, node);
      let transitionId: string | undefined;
      let prepared = false;
      let activated = false;
      let bouncerReplicationStarted = false;
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
          installation.lapiUrl === null ||
          installation.machineConnectivityPending ||
          installation.centralFirewallId === centralFirewall.id ||
          installation.localRemediation !== req.body.localRemediation
        ) {
          throw new HttpException('CrowdSec Machine central LAPI transition is not available', 409);
        }

        machineName = installation.machineName;
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend = installation.localRemediation
          ? ((await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ??
            'iptables')
          : undefined;
        transitionId = uuid.v4();
        const transition = {
          transitionId,
          confirm: true,
          expected: {
            mode: 'machine' as const,
            localRemediation: installation.localRemediation,
            machineName,
            lapiUrl: installation.lapiUrl,
          },
          target: {
            mode: 'machine' as const,
            localRemediation: installation.localRemediation,
            machineName,
            lapiUrl,
          },
          authorityChanged: true,
          backend,
        };

        progress('Moving CrowdSec Machine node ' + node.name + ' to the new Local API');
        await communication.prepareCrowdSecTransition(transition, channel);
        prepared = true;
        transitionAttempts.push({ node, transitionId });
        await lapiService.replicateMachineCredentials(
          centralLapiNodes,
          communication,
          machineName,
          progress,
        );
        const bouncerApiKey = installation.localRemediation
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
          localRemediation: installation.localRemediation,
        });
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
        });
        return true;
      } catch (error) {
        if (prepared && !activated && transitionId) {
          try {
            const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
            await communication.recoverCrowdSecTransition(transitionId);
          } catch {
            recoveryRequired = true;
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
            error:
              !machineCleanup.completed ||
              (bouncerCleanup !== undefined && !bouncerCleanup.completed)
                ? 'CrowdSec target Local API cleanup is incomplete and must be retried manually'
                : error instanceof Error
                  ? error.message
                  : 'CrowdSec cluster node central LAPI transition failed',
            ...(!machineCleanup.completed ? { central_machine_cleanup_required: true } : {}),
            ...(bouncerCleanup && !bouncerCleanup.completed
              ? { central_bouncer_cleanup_required: true }
              : {}),
          });
          return false;
        }
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: recoveryRequired ? 'recovery_required' : 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'CrowdSec cluster node central LAPI transition failed',
        });
      }
      return false;
    });
    if (!completedAllNodes) {
      await this.rollbackClusterTransitions(transitionAttempts, initialNodeStates, results);
      this.appendCancelledNodeResults(nodes, results, initialNodeStates);
    }
    const finalizationCompleted = completedAllNodes
      ? await this.finalizeClusterTransitions(transitionAttempts, results)
      : true;
    if (completedAllNodes && finalizationCompleted) {
      await this.cleanupSourceMachineRegistrations(results, initialNodeStates, lapiService);
    }
    const completed = results.every(
      (result) => result.status === 'completed' || result.status === 'finalization_failed',
    );
    if (!finalizationCompleted) {
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'CrowdSec transition is active, but one or more nodes require finalization confirmation',
        ),
      );
    }
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec Machine cluster nodes moved to the new Local API'
          : 'CrowdSec Machine central LAPI transition finished with node failures',
      ),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        ...(!finalizationCompleted ? { finalization_incomplete: true } : {}),
        nodes: results,
      });
  }

  @Validate(CrowdSecClusterTransitionDto)
  public async transitionMachineAddress(req: Request): Promise<ResponseBuilder> {
    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId === undefined ||
      req.body.lapiUrl === undefined ||
      req.body.bouncerApiKey !== undefined
    ) {
      throw new HttpException('Invalid CrowdSec cluster Machine address transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req, false);
    const initialNodeStates = await this.captureInitialNodeStates(nodes);
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    const installations = await Promise.all(
      nodes.map((node) => installationRepository.findByFirewallId(node.id)),
    );
    if (
      installations.some(
        (installation) =>
          installation?.mode !== CrowdSecInstallationMode.Machine ||
          installation.centralFirewallId !== req.body.centralFirewallId ||
          installation.machineName === null ||
          installation.lapiUrl === null ||
          installation.machineConnectivityPending ||
          installation.localRemediation !== req.body.localRemediation,
      )
    ) {
      throw new HttpException('CrowdSec Machine address transition is not available', 409);
    }

    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    const previousLapiUrls = installations.map((installation) => installation!.lapiUrl!);
    if (previousLapiUrls.every((previousLapiUrl) => previousLapiUrl === lapiUrl)) {
      return ResponseBuilder.buildResponse().status(200).body({
        changed: false,
        message: 'CrowdSec Local API address is unchanged',
      });
    }
    const previousListenerUris = [
      ...new Set(
        previousLapiUrls.map((previousLapiUrl) =>
          CrowdSecLapiSharedService.listenerUriForLapiUrl(previousLapiUrl),
        ),
      ),
    ];
    if (previousListenerUris.length !== 1) {
      throw new HttpException(
        'Selected CrowdSec Machine nodes do not share the current central Local API listener',
        409,
      );
    }

    const { centralLapiNodes } = await this.getExternalCentralLapiTarget(
      req.body.centralFirewallId,
      nodes,
    );
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const previousListenerUri = previousListenerUris[0];
    const targetListenerUri = CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl);
    const listenerChangeRequired = previousListenerUri !== targetListenerUri;
    if (
      listenerChangeRequired &&
      (await installationRepository.hasMachineDependentsExcept(
        req.body.centralFirewallId,
        nodes.map((node) => node.id),
      ))
    ) {
      throw new HttpException(
        'CrowdSec central Local API port cannot be changed while other Machines are connected',
        409,
      );
    }

    let listenerChanged = false;
    if (listenerChangeRequired) {
      channel.emit(
        'message',
        new ProgressPayload('info', false, 'Reconfiguring CrowdSec central Local API listener'),
      );
      await lapiService.preflight(centralLapiNodes, targetListenerUri);
      await lapiService.enable(centralLapiNodes);
      listenerChanged = true;
    }

    const results: ClusterMachineNodeResult[] = [];
    const transitionAttempts: ClusterTransitionAttempt[] = [];
    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Changing CrowdSec Local API address in cluster nodes'),
    );
    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
      this.requireInitialNodeState(initialNodeStates, node);
      const installation = installations.find((candidate) => candidate!.firewallId === node.id)!;
      const machineName = installation.machineName!;
      let transitionId: string | undefined;
      let prepared = false;
      let activated = false;
      let recoveryRequired = false;
      try {
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend = installation.localRemediation
          ? ((await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ??
            'iptables')
          : undefined;
        transitionId = uuid.v4();
        const transition = {
          transitionId,
          confirm: true,
          expected: {
            mode: 'machine' as const,
            localRemediation: installation.localRemediation,
            machineName,
            lapiUrl: installation.lapiUrl,
          },
          target: {
            mode: 'machine' as const,
            localRemediation: installation.localRemediation,
            machineName,
            lapiUrl,
          },
          authorityChanged: false,
          backend,
        };
        channel.emit(
          'message',
          new ProgressPayload(
            'info',
            false,
            'Changing CrowdSec Local API address on node ' + node.name,
          ),
        );
        await communication.prepareCrowdSecTransition(transition, channel);
        prepared = true;
        transitionAttempts.push({ node, transitionId });
        await communication.activateCrowdSecTransition({ transitionId }, channel);
        activated = true;
        await this.persistMachineNode({
          node,
          centralFirewallId: installation.centralFirewallId!,
          lapiUrl,
          machineName,
          localRemediation: installation.localRemediation,
        });
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
        });
        return true;
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
          error:
            error instanceof Error
              ? error.message
              : 'CrowdSec cluster node address transition failed',
        });
      }
      return false;
    });
    if (!completedAllNodes) {
      await this.rollbackClusterTransitions(transitionAttempts, initialNodeStates, results);
      this.appendCancelledNodeResults(nodes, results, initialNodeStates);
    }
    const finalizationCompleted = completedAllNodes
      ? await this.finalizeClusterTransitions(transitionAttempts, results)
      : true;
    const completed = results.every(
      (result) => result.status === 'completed' || result.status === 'finalization_failed',
    );
    if (!finalizationCompleted) {
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'CrowdSec transition is active, but one or more nodes require finalization confirmation',
        ),
      );
    }
    if (listenerChanged && !completedAllNodes) {
      try {
        await lapiService.configureListeners(centralLapiNodes, previousListenerUri);
      } catch {
        channel.emit(
          'message',
          new ProgressPayload(
            'warning',
            false,
            'CrowdSec central Local API listener rollback is incomplete and must be retried manually',
          ),
        );
      }
    }
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec Local API address changed on all cluster nodes'
          : 'CrowdSec Local API address transition finished with node failures',
      ),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        ...(!finalizationCompleted ? { finalization_incomplete: true } : {}),
        nodes: results,
      });
  }

  @Validate(CrowdSecClusterTransitionDto)
  public async transitionRemediation(req: Request): Promise<ResponseBuilder> {
    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId !== undefined ||
      req.body.lapiUrl !== undefined
    ) {
      throw new HttpException('Invalid CrowdSec cluster remediation transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req, false);
    const initialNodeStates = await this.captureInitialNodeStates(nodes);
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    const results: ClusterMachineNodeResult[] = [];
    const transitionAttempts: ClusterTransitionAttempt[] = [];

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Changing CrowdSec local remediation in cluster nodes'),
    );
    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
      this.requireInitialNodeState(initialNodeStates, node);
      let transitionId: string | undefined;
      let prepared = false;
      let activated = false;
      let bouncerReplicationStarted = false;
      let recoveryRequired = false;
      let machineName = '';
      let centralLapiNodes: CentralLapiNode[] = [];
      try {
        const installation = await new CrowdSecInstallationRepository(
          db.getSource().manager,
        ).findByFirewallId(node.id);
        if (
          installation?.mode !== CrowdSecInstallationMode.Machine ||
          installation.centralFirewallId === null ||
          installation.machineName === null ||
          installation.lapiUrl === null ||
          installation.machineConnectivityPending ||
          installation.localRemediation === req.body.localRemediation
        ) {
          throw new HttpException('CrowdSec Machine remediation transition is not available', 409);
        }

        machineName = installation.machineName;
        const lapiUrl = CrowdSecLapiSharedService.lapiUrl(installation.lapiUrl);
        centralLapiNodes = await lapiService.getCentralNodes(
          await lapiService.getCentralFirewall(installation.centralFirewallId),
        );
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend = req.body.localRemediation
          ? ((await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ??
            'iptables')
          : undefined;
        transitionId = uuid.v4();
        const transition = {
          transitionId,
          confirm: true,
          expected: {
            mode: 'machine' as const,
            localRemediation: installation.localRemediation,
            machineName,
            lapiUrl,
          },
          target: {
            mode: 'machine' as const,
            localRemediation: req.body.localRemediation,
            machineName,
            lapiUrl,
          },
          authorityChanged: false,
          backend,
        };

        if (req.body.localRemediation) {
          await lapiService.preflight(
            centralLapiNodes,
            CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl),
          );
          await lapiService.enable(centralLapiNodes);
        }
        channel.emit(
          'message',
          new ProgressPayload(
            'info',
            false,
            'Changing CrowdSec local remediation on node ' + node.name,
          ),
        );
        await communication.prepareCrowdSecTransition(transition, channel);
        prepared = true;
        transitionAttempts.push({ node, transitionId });
        const bouncerApiKey = req.body.localRemediation
          ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
          : undefined;
        if (bouncerApiKey) {
          bouncerReplicationStarted = true;
          await lapiService.replicateBouncer(centralLapiNodes, machineName, bouncerApiKey);
        }
        await communication.activateCrowdSecTransition({ transitionId, bouncerApiKey }, channel);
        activated = true;
        await this.persistMachineNode({
          node,
          centralFirewallId: installation.centralFirewallId,
          lapiUrl: installation.lapiUrl,
          machineName,
          localRemediation: req.body.localRemediation,
        });
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
          central_bouncer_cleanup_required:
            !req.body.localRemediation && installation.localRemediation,
        });
        return true;
      } catch (error) {
        if (prepared && req.body.localRemediation && !activated && transitionId) {
          try {
            const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
            await communication.recoverCrowdSecTransition(transitionId);
          } catch {
            recoveryRequired = true;
          }
          if (bouncerReplicationStarted) {
            const cleanup = await lapiService.cleanupBouncer(centralLapiNodes, machineName);
            if (!cleanup.completed) {
              results.push({
                firewall_id: node.id,
                name: node.name,
                machine_name: machineName,
                status: recoveryRequired ? 'recovery_required' : 'failed',
                error:
                  'CrowdSec central Local API Bouncer cleanup is incomplete and must be retried manually',
                central_bouncer_cleanup_required: true,
              });
              return false;
            }
          }
        }
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: recoveryRequired ? 'recovery_required' : 'failed',
          error:
            error instanceof Error ? error.message : 'CrowdSec cluster node remediation failed',
        });
      }
      return false;
    });
    if (!completedAllNodes) {
      await this.rollbackClusterTransitions(transitionAttempts, initialNodeStates, results);
      this.appendCancelledNodeResults(nodes, results, initialNodeStates);
    }
    const finalizationCompleted = completedAllNodes
      ? await this.finalizeClusterTransitions(transitionAttempts, results)
      : true;
    const completed = results.every(
      (result) => result.status === 'completed' || result.status === 'finalization_failed',
    );
    if (!finalizationCompleted) {
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'CrowdSec transition is active, but one or more nodes require finalization confirmation',
        ),
      );
    }
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec local remediation changed on all cluster nodes'
          : 'CrowdSec local remediation changed with node failures',
      ),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        ...(!finalizationCompleted ? { finalization_incomplete: true } : {}),
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

    const nodes = await this.getAuthorizedNodes(req, false);
    const initialNodeStates = await this.captureInitialNodeStates(nodes);
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const results: ClusterMachineNodeResult[] = [];

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Restoring CrowdSec LAPI installations in cluster nodes'),
    );
    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
      this.requireInitialNodeState(initialNodeStates, node);
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
        return true;
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
      return false;
    });
    if (!completedAllNodes) {
      this.appendCancelledNodeResults(nodes, results, initialNodeStates);
    }
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

  private async cleanupSourceMachineRegistrations(
    results: ClusterMachineNodeResult[],
    snapshots: Map<number, ClusterCrowdSecNodeSnapshot>,
    lapiService: CrowdSecLapiSharedService,
  ): Promise<void> {
    for (const result of results) {
      const snapshot = snapshots.get(result.firewall_id)?.installation;
      if (
        result.status !== 'completed' ||
        snapshot?.mode !== CrowdSecInstallationMode.Machine ||
        snapshot.centralFirewallId === null ||
        snapshot.machineName === null
      ) {
        continue;
      }
      try {
        const sourceNodes = await lapiService.getCentralNodes(
          await lapiService.getCentralFirewall(snapshot.centralFirewallId),
        );
        result.source_machine_removed = (
          await lapiService.cleanupMachine(sourceNodes, snapshot.machineName)
        ).completed;
      } catch {
        result.source_machine_removed = false;
      }
      result.source_bouncer_cleanup_required = snapshot.localRemediation;
    }
  }

  private async restoreInitialNodeState(
    node: Firewall,
    snapshot: ClusterCrowdSecNodeSnapshot,
  ): Promise<void> {
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    if (snapshot.installation) {
      await installationRepository.restoreInstallation({
        firewallId: node.id,
        ...snapshot.installation,
      });
    } else {
      await installationRepository.removeByFirewallId(node.id);
    }
    await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
      node,
      snapshot.crowdsecCompatibility,
    );
  }

  private async rollbackClusterTransitions(
    attempts: ClusterTransitionAttempt[],
    snapshots: Map<number, ClusterCrowdSecNodeSnapshot>,
    results: ClusterMachineNodeResult[],
  ): Promise<void> {
    for (const attempt of [...attempts].reverse()) {
      const result = results.find((candidate) => candidate.firewall_id === attempt.node.id);
      if (!result) {
        continue;
      }
      try {
        const communication = await CrowdSecLapiSharedService.agentCommunication(
          attempt.node,
          false,
        );
        await communication.recoverCrowdSecTransition(attempt.transitionId);
        await this.restoreInitialNodeState(
          attempt.node,
          this.requireInitialNodeState(snapshots, attempt.node),
        );
        result.status = 'rolled_back';
      } catch {
        result.status = 'rollback_failed';
        result.error = 'CrowdSec node rollback failed and requires manual recovery';
      }
    }
  }

  private async finalizeClusterTransitions(
    attempts: ClusterTransitionAttempt[],
    results: ClusterMachineNodeResult[],
  ): Promise<boolean> {
    let finalized = true;
    for (const attempt of attempts) {
      const result = results.find((candidate) => candidate.firewall_id === attempt.node.id);
      if (!result || result.status !== 'completed') {
        continue;
      }
      try {
        const communication = await CrowdSecLapiSharedService.agentCommunication(
          attempt.node,
          false,
        );
        await communication.finalizeCrowdSecTransition(attempt.transitionId);
      } catch (error) {
        finalized = false;
        result.status = 'finalization_failed';
        result.error =
          error instanceof Error
            ? error.message
            : 'CrowdSec transition finalization must be retried manually';
      }
    }
    return finalized;
  }

  private appendCancelledNodeResults(
    nodes: Firewall[],
    results: ClusterMachineNodeResult[],
    snapshots: Map<number, ClusterCrowdSecNodeSnapshot>,
  ): void {
    const processedNodeIds = new Set(results.map((result) => result.firewall_id));
    for (const node of nodes) {
      if (processedNodeIds.has(node.id)) {
        continue;
      }
      const snapshot = this.requireInitialNodeState(snapshots, node);
      results.push({
        firewall_id: node.id,
        name: node.name,
        machine_name:
          snapshot.installation?.machineName ??
          CrowdSecLapiSharedService.machineNameForFirewall(node),
        status: 'cancelled',
        error: 'CrowdSec cluster transition was cancelled after a previous node failed',
      });
    }
  }

  private async captureInitialNodeStates(
    nodes: Firewall[],
  ): Promise<Map<number, ClusterCrowdSecNodeSnapshot>> {
    const repository = new CrowdSecInstallationRepository(db.getSource().manager);
    const snapshots = new Map<number, ClusterCrowdSecNodeSnapshot>();

    for (const node of nodes) {
      const installation = await repository.findByFirewallId(node.id);
      snapshots.set(node.id, {
        firewallId: node.id,
        crowdsecCompatibility: (node.options & FireWallOptMask.CROWDSEC_COMPAT) !== 0,
        installation: installation
          ? {
              mode: installation.mode,
              centralFirewallId: installation.centralFirewallId,
              lapiUrl: installation.lapiUrl,
              machineName: installation.machineName,
              localRemediation: installation.localRemediation,
              machineConnectivityPending: installation.machineConnectivityPending,
              centralLapiEnabled: installation.centralLapiEnabled,
              consoleEnrollmentConfirmed: installation.consoleEnrollmentConfirmed,
            }
          : null,
      });
    }

    return snapshots;
  }

  private requireInitialNodeState(
    snapshots: Map<number, ClusterCrowdSecNodeSnapshot>,
    node: Firewall,
  ): ClusterCrowdSecNodeSnapshot {
    const snapshot = snapshots.get(node.id);
    if (!snapshot) {
      throw new HttpException('CrowdSec cluster node initial state was not captured', 500);
    }
    return snapshot;
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

  private async getAuthorizedNodes(
    req: Request,
    allowNodeSelection: boolean = true,
  ): Promise<Firewall[]> {
    const clusterNodes = [...this._cluster.firewalls].sort((first, second) => first.id - second.id);
    const requestedNodeIds = req.body.nodeIds as number[] | undefined;
    if (!allowNodeSelection && requestedNodeIds !== undefined) {
      throw new HttpException('CrowdSec cluster transitions must include every cluster node', 422);
    }
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
