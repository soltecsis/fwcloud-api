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

import { Request as ExpressRequest } from 'express';
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
import { Validate, ValidateQuery } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import db from '../../../database/database-manager';
import { Channel } from '../../../sockets/channels/channel';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import { CrowdSecClusterMachineInstallDto } from './dto/cluster-machine-install.dto';
import { CrowdSecClusterTransitionDto } from './dto/cluster-transition.dto';
import { CrowdSecCollectionDto } from './dto/collection.dto';
import {
  CrowdSecClusterCollectionAcquisitionNodeQueryDto,
  CrowdSecClusterCollectionAcquisitionQueryDto,
  CrowdSecCollectionAcquisitionParserSelectionDto,
  CrowdSecCollectionAcquisitionUpdateDto,
} from './dto/collection-acquisition.dto';
import {
  CentralLapiNode,
  CentralLapiReplicationError,
  CrowdSecLapiSharedService,
} from './crowdsec-lapi-shared.service';
import { CrowdSecBlockingStatisticsSamplingDto } from './dto/blocking-statistics-sampling.dto';
import {
  CrowdSecBlockingStatisticsClusterAddressHistoryQueryDto,
  CrowdSecBlockingStatisticsClusterAddressOptionsQueryDto,
  CrowdSecBlockingStatisticsClusterHistoryQueryDto,
} from './dto/blocking-statistics-history-query.dto';
import { CrowdSecBlockingStatisticsSharedService } from './crowdsec-blocking-statistics-shared.service';
import { CrowdSecCollectionAcquisitionService } from './crowdsec-collection-acquisition.service';
import {
  Body,
  Example,
  Get,
  OperationId,
  Path,
  Post,
  Put,
  Query,
  Request,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from 'tsoa';

interface CrowdSecClusterApiEnvelopeResponse<TData> {
  status: number;
  response: string;
  message: string;
  data: TData;
}

interface CrowdSecClusterApiErrorResponse {
  status: number;
  response: string;
  message: string;
  errors?: Record<string, unknown>;
}

interface CrowdSecClusterCollectionsResponse {
  nodes: Array<{
    firewall_id: number;
    name: string;
    collections?: Record<string, unknown>;
    error?: string;
  }>;
}

interface CrowdSecClusterOperationResponse {
  completed: boolean;
  finalization_incomplete?: boolean;
  connectivity_confirmation_required?: boolean;
  connectivity_confirmation_reason?: string;
  pending_connectivity?: boolean;
  central_lapi_nodes?: Array<{ firewall_id: number; name: string }>;

  nodes: ClusterMachineNodeResult[];
}
interface CrowdSecClusterCollectionOperationResponse {
  completed: boolean;
  operation: ClusterCollectionOperation;
  rollback_completed?: boolean;
  manual_reconciliation_required?: boolean;
  nodes: ClusterCollectionNodeResult[];
}

interface CrowdSecClusterBlockingStatisticsSamplingResponse {
  enabled: boolean;
  sampling_interval: number;
  request_max_samples: number;
  cache_max_size: number;
  completed?: boolean;
  nodes: Array<Record<string, unknown>>;
}

interface CrowdSecClusterBlockingStatisticsCounter {
  packets: number;
  bytes: number;
}

interface CrowdSecClusterBlockingStatisticsHistoryResponse {
  samples: Array<{
    collected_at: string;
    policy_generation: string;
    ipv4_input: CrowdSecClusterBlockingStatisticsCounter;
    ipv4_forward: CrowdSecClusterBlockingStatisticsCounter;
    ipv6_input: CrowdSecClusterBlockingStatisticsCounter;
    ipv6_forward: CrowdSecClusterBlockingStatisticsCounter;
  }>;
  pagination: Record<string, number>;
}

interface CrowdSecClusterBlockingStatisticsAddressHistoryResponse {
  samples: Array<{
    address: string;
    collected_at: string;
    policy_generation: string;
    packets: number;
    bytes: number;
  }>;
  pagination: Record<string, number>;
}

interface CrowdSecClusterBlockingStatisticsAddressOptionsResponse {
  addresses: string[];
  pagination: Record<string, number>;
}

interface CrowdSecClusterCollectionAcquisitionResponse {
  collection: string;
  file_path: string;
  state: 'ready' | 'automatic_configuration_unavailable' | 'manual_review_required';
  label_type?: string;
  candidate_label_types: string[];
  log_paths: string[];
  message: string;
}

type CrowdSecClusterDynamicResponse = Record<string, unknown>;

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

type ClusterCollectionOperation = 'install' | 'remove' | 'update';

type ClusterCollectionNodeResult = {
  firewall_id: number;
  name: string;
  status: 'completed' | 'skipped' | 'failed' | 'rolled_back' | 'rollback_failed' | 'cancelled';
  error?: string;
};

type ClusterCollectionNode = {
  firewall: Firewall;
  communication: AgentCommunication;
  installed: boolean;
};

@Route('fwclouds/{fwcloud}/clusters/{cluster}/system/crowdsec')
@Tags('crowdsec')
export class CrowdSecClusterController extends Controller {
  private _cluster: Cluster;

  public async make(request: ExpressRequest): Promise<void> {
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
  @OperationId('Install CrowdSec machines in cluster')
  @Post('machines/install')
  @SuccessResponse('200', 'Cluster machines installed')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      central_lapi_nodes: [{ firewall_id: 12, name: 'central-lapi-node' }],
      nodes: [
        {
          firewall_id: 21,
          name: 'cluster-node-1',
          machine_name: 'fwcloud-cluster-node-1',
          status: 'completed',
        },
      ],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async installMachine(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecClusterMachineInstallDto,
  ): Promise<ResponseBuilder> {
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
  @OperationId('Change CrowdSec role in cluster')
  @Post('transitions/role')
  @SuccessResponse('200', 'Cluster role transitioned')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      nodes: [
        {
          firewall_id: 21,
          name: 'cluster-node-1',
          machine_name: 'fwcloud-cluster-node-1',
          status: 'completed',
        },
      ],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionRole(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecClusterTransitionDto,
  ): Promise<ResponseBuilder> {
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
    const replicatedMachineNodes = new Map<number, CentralLapiNode[]>();
    const replicatedBouncerNodes = new Map<number, CentralLapiNode[]>();

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
        await this.replicateCentralMachineCredentials(
          lapiService,
          replicatedMachineNodes,
          node.id,
          centralLapiNodes,
          communication,
          machineName,
          progress,
        );
        const bouncerApiKey = req.body.localRemediation
          ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
          : undefined;
        if (bouncerApiKey) {
          await this.replicateCentralBouncer(
            lapiService,
            replicatedBouncerNodes,
            node.id,
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
      await this.rollbackClusterTransitions(transitionAttempts, initialNodeStates, results);
      await this.cleanupCentralReplicasAfterFailure(
        lapiService,
        results,
        replicatedMachineNodes,
        replicatedBouncerNodes,
      );
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
  @OperationId('Move cluster CrowdSec machines to central LAPI')
  @Post('transitions/lapi')
  @SuccessResponse('200', 'Cluster central LAPI transitioned')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      nodes: [
        {
          firewall_id: 21,
          name: 'cluster-node-1',
          machine_name: 'fwcloud-cluster-node-1',
          status: 'completed',
        },
      ],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionMachineCentralLapi(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecClusterTransitionDto,
  ): Promise<ResponseBuilder> {
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
    const replicatedMachineNodes = new Map<number, CentralLapiNode[]>();
    const replicatedBouncerNodes = new Map<number, CentralLapiNode[]>();

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
        await this.replicateCentralMachineCredentials(
          lapiService,
          replicatedMachineNodes,
          node.id,
          centralLapiNodes,
          communication,
          machineName,
          progress,
        );
        const bouncerApiKey = installation.localRemediation
          ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
          : undefined;
        if (bouncerApiKey) {
          await this.replicateCentralBouncer(
            lapiService,
            replicatedBouncerNodes,
            node.id,
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
      await this.cleanupCentralReplicasAfterFailure(
        lapiService,
        results,
        replicatedMachineNodes,
        replicatedBouncerNodes,
      );
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
  @OperationId('Change cluster CrowdSec machine LAPI address')
  @Post('transitions/address')
  @SuccessResponse('200', 'Cluster address transitioned')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      nodes: [
        {
          firewall_id: 21,
          name: 'cluster-node-1',
          machine_name: 'fwcloud-cluster-node-1',
          status: 'completed',
        },
      ],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionMachineAddress(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecClusterTransitionDto,
  ): Promise<ResponseBuilder> {
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
  @OperationId('Change cluster CrowdSec remediation')
  @Post('transitions/remediation')
  @SuccessResponse('200', 'Cluster remediation transitioned')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      nodes: [
        {
          firewall_id: 21,
          name: 'cluster-node-1',
          machine_name: 'fwcloud-cluster-node-1',
          status: 'completed',
        },
      ],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionRemediation(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecClusterTransitionDto,
  ): Promise<ResponseBuilder> {
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
    const replicatedBouncerNodes = new Map<number, CentralLapiNode[]>();

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Changing CrowdSec local remediation in cluster nodes'),
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
          installation.lapiUrl === null ||
          installation.machineConnectivityPending ||
          installation.localRemediation === req.body.localRemediation
        ) {
          throw new HttpException('CrowdSec Machine remediation transition is not available', 409);
        }

        machineName = installation.machineName;
        const lapiUrl = CrowdSecLapiSharedService.lapiUrl(installation.lapiUrl);
        const centralLapiNodes = req.body.localRemediation
          ? await lapiService.getCentralNodes(
              await lapiService.getCentralFirewall(installation.centralFirewallId),
            )
          : [];
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
          await this.replicateCentralBouncer(
            lapiService,
            replicatedBouncerNodes,
            node.id,
            centralLapiNodes,
            machineName,
            bouncerApiKey,
          );
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
      await this.cleanupCentralReplicasAfterFailure(
        lapiService,
        results,
        new Map<number, CentralLapiNode[]>(),
        replicatedBouncerNodes,
      );
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
  @OperationId('List cluster CrowdSec collections')
  @Get('collections')
  @SuccessResponse('200', 'Cluster collections retrieved')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionsResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      nodes: [{ firewall_id: 21, name: 'cluster-node-1', collections: { collections: [] } }],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async collections(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
  ): Promise<ResponseBuilder> {
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

  @Validate()
  @ValidateQuery(CrowdSecClusterCollectionAcquisitionQueryDto)
  @OperationId('Get cluster CrowdSec collection acquisition')
  @Get('collections/acquisition')
  @SuccessResponse('200', 'Cluster collection acquisition retrieved')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionAcquisitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      collection: 'crowdsecurity/sshd',
      file_path: '/etc/crowdsec/acquis.d/crowdsecurity-sshd.yaml',
      state: 'ready',
      label_type: 'syslog',
      candidate_label_types: [],
      log_paths: ['/var/log/auth.log'],
      message: 'CrowdSec acquisition is managed by FWCloud',
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async collectionAcquisition(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Query('name') nameQuery: string,
    @Query('node_id') nodeId: number,
  ): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
    const name = req.query.name as string;
    await CrowdSecCollectionAcquisitionService.ensureCollectionInstalled(communication, name);
    const acquisition = await communication.getCrowdSecCollectionAcquisition(name);

    return ResponseBuilder.buildResponse().status(200).body(acquisition);
  }

  @Validate(CrowdSecCollectionAcquisitionUpdateDto)
  @ValidateQuery(CrowdSecClusterCollectionAcquisitionNodeQueryDto)
  @OperationId('Update cluster CrowdSec collection acquisition')
  @Put('collections/acquisition')
  @SuccessResponse('200', 'Cluster collection acquisition updated')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionAcquisitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      collection: 'crowdsecurity/sshd',
      file_path: '/etc/crowdsec/acquis.d/crowdsecurity-sshd.yaml',
      state: 'ready',
      label_type: 'syslog',
      candidate_label_types: [],
      log_paths: ['/var/log/auth.log'],
      message: 'CrowdSec acquisition is managed by FWCloud',
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async updateCollectionAcquisition(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Body() body: CrowdSecCollectionAcquisitionUpdateDto,
    @Query('node_id') nodeId: number,
  ): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    (await CrowdSecPolicy.manage(node, req.session.user)).authorize();

    const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
    await CrowdSecCollectionAcquisitionService.ensureCollectionInstalled(
      communication,
      req.body.name,
    );
    const acquisition = await communication.updateCrowdSecCollectionAcquisition({
      name: req.body.name,
      logPaths: req.body.log_paths,
    });

    return ResponseBuilder.buildResponse().status(200).body(acquisition);
  }

  @Validate(CrowdSecCollectionAcquisitionParserSelectionDto)
  @ValidateQuery(CrowdSecClusterCollectionAcquisitionNodeQueryDto)
  @OperationId('Select cluster CrowdSec collection acquisition parser')
  @Put('collections/acquisition/parser')
  @SuccessResponse('200', 'Cluster collection acquisition parser selected')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionAcquisitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      collection: 'crowdsecurity/sshd',
      file_path: '/etc/crowdsec/acquis.d/crowdsecurity-sshd.yaml',
      state: 'ready',
      label_type: 'syslog',
      candidate_label_types: [],
      log_paths: [],
      message: 'CrowdSec acquisition is managed by FWCloud',
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async selectCollectionAcquisitionParser(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Body() body: CrowdSecCollectionAcquisitionParserSelectionDto,
    @Query('node_id') nodeId: number,
  ): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    (await CrowdSecPolicy.manage(node, req.session.user)).authorize();

    const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
    await CrowdSecCollectionAcquisitionService.ensureCollectionInstalled(
      communication,
      req.body.name,
    );
    const acquisition = await communication.selectCrowdSecCollectionAcquisitionParser({
      name: req.body.name,
      labelType: req.body.label_type,
    });

    return ResponseBuilder.buildResponse().status(200).body(acquisition);
  }

  @Validate()
  @OperationId('Get cluster CrowdSec blocking statistics sampling configuration')
  @Get('blocking-statistics/sampling')
  @SuccessResponse('200', 'Cluster blocking statistics sampling configuration retrieved')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterBlockingStatisticsSamplingResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      enabled: true,
      sampling_interval: 60,
      request_max_samples: 1000,
      cache_max_size: 10000,
      nodes: [{ firewall_id: 12, name: 'node-1' }],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatisticsSampling(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
  ): Promise<ResponseBuilder> {
    const nodes = await this.getViewNodes(req);
    const configuration =
      await CrowdSecBlockingStatisticsSharedService.samplingService().configuration(nodes[0].id);
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        ...CrowdSecBlockingStatisticsSharedService.samplingResponse(configuration),
        nodes: nodes.map((node) => ({ firewall_id: node.id, name: node.name })),
      });
  }

  @Validate(CrowdSecBlockingStatisticsSamplingDto)
  @OperationId('Update cluster CrowdSec blocking statistics sampling configuration')
  @Put('blocking-statistics/sampling')
  @SuccessResponse('200', 'Cluster blocking statistics sampling configuration updated')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterBlockingStatisticsSamplingResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      enabled: true,
      sampling_interval: 60,
      request_max_samples: 1000,
      cache_max_size: 10000,
      nodes: [],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async updateBlockingStatisticsSampling(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Body() body: CrowdSecBlockingStatisticsSamplingDto,
  ): Promise<ResponseBuilder> {
    const nodes = await this.getAuthorizedNodes(req, false);
    const service = CrowdSecBlockingStatisticsSharedService.samplingService();
    const current = await service.configuration(nodes[0].id);
    const result = await service.update(nodes, {
      enabled: req.body.enabled,
      samplingInterval: req.body.sampling_interval ?? current.samplingInterval,
      requestMaxSamples: req.body.request_max_samples ?? current.requestMaxSamples,
      cacheMaxSize: req.body.cache_max_size ?? current.cacheMaxSize,
    });
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed: result.completed,
        ...CrowdSecBlockingStatisticsSharedService.samplingResponse(result.configuration),
        nodes: result.nodes,
      });
  }

  @Validate()
  @ValidateQuery(CrowdSecBlockingStatisticsClusterHistoryQueryDto)
  @OperationId('List cluster CrowdSec blocking statistics')
  @Get('blocking-statistics')
  @SuccessResponse('200', 'Cluster blocking statistics retrieved')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterBlockingStatisticsHistoryResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      samples: [
        {
          collected_at: '2026-10-23T10:00:00.000Z',
          policy_generation: '1792659255373',
          ipv4_input: { packets: 12, bytes: 840 },
          ipv4_forward: { packets: 0, bytes: 0 },
          ipv6_input: { packets: 0, bytes: 0 },
          ipv6_forward: { packets: 0, bytes: 0 },
        },
      ],
      pagination: { page: 1, limit: 1000, total: 1, pages: 1 },
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatistics(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Query('node_id') nodeId: number,
    @Query('starts_at') startsAt?: number,
    @Query('ends_at') endsAt?: number,
    @Query('page') pageQuery?: number,
    @Query('limit') limit?: number,
  ): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    const history = await (
      await CrowdSecBlockingStatisticsSharedService.statisticsService(this._app)
    ).history(
      node.id,
      CrowdSecBlockingStatisticsSharedService.range(req),
      CrowdSecBlockingStatisticsSharedService.pagination(req),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        samples: history.samples.map((sample) =>
          CrowdSecBlockingStatisticsSharedService.sampleResponse(sample),
        ),
        pagination: CrowdSecBlockingStatisticsSharedService.paginationResponse(history),
      });
  }

  @Validate()
  @ValidateQuery(CrowdSecBlockingStatisticsClusterAddressHistoryQueryDto)
  @OperationId('List cluster CrowdSec blocking statistics by address')
  @Get('blocking-statistics/addresses')
  @SuccessResponse('200', 'Cluster address blocking statistics retrieved')
  @Example<
    CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterBlockingStatisticsAddressHistoryResponse>
  >({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      samples: [
        {
          address: '203.0.113.10',
          collected_at: '2026-10-23T10:00:00.000Z',
          policy_generation: '1792659255373',
          packets: 42,
          bytes: 4096,
        },
      ],
      pagination: { page: 1, limit: 1000, total: 1, pages: 1 },
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatisticsAddresses(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Query('node_id') nodeId: number,
    @Query('addresses') addresses: string,
    @Query('starts_at') startsAt?: number,
    @Query('ends_at') endsAt?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    const history = await (
      await CrowdSecBlockingStatisticsSharedService.statisticsService(this._app)
    ).addressHistory(
      node.id,
      CrowdSecBlockingStatisticsSharedService.addresses(req.query.addresses),
      CrowdSecBlockingStatisticsSharedService.range(req),
      CrowdSecBlockingStatisticsSharedService.pagination(req),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        samples: history.samples.map((sample) =>
          CrowdSecBlockingStatisticsSharedService.addressSampleResponse(sample),
        ),
        pagination: CrowdSecBlockingStatisticsSharedService.paginationResponse(history),
      });
  }

  @Validate()
  @ValidateQuery(CrowdSecBlockingStatisticsClusterAddressOptionsQueryDto)
  @OperationId('List cluster CrowdSec blocking statistics address options')
  @Get('blocking-statistics/addresses/options')
  @SuccessResponse('200', 'Cluster blocking statistics address options retrieved')
  @Example<
    CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterBlockingStatisticsAddressOptionsResponse>
  >({
    status: 200,
    response: 'OK',
    message: '',
    data: { addresses: ['203.0.113.10'], pagination: { page: 1, limit: 1000, total: 1, pages: 1 } },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatisticsAddressOptions(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() cluster: number,
    @Query('node_id') nodeId: number,
    @Query('starts_at') startsAt?: number,
    @Query('ends_at') endsAt?: number,
    @Query('page') pageQuery?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    const page = await (
      await CrowdSecBlockingStatisticsSharedService.statisticsService(this._app)
    ).addressOptions(node.id, {
      ...CrowdSecBlockingStatisticsSharedService.range(req),
      ...CrowdSecBlockingStatisticsSharedService.pagination(req),
      search: req.query.search as string | undefined,
    });
    return ResponseBuilder.buildResponse()
      .status(200)
      .body(CrowdSecBlockingStatisticsSharedService.addressOptionsResponse(page));
  }

  @Validate(CrowdSecCollectionDto)
  @OperationId('Install CrowdSec collection in cluster')
  @Post('collections/install')
  @SuccessResponse('200', 'Cluster collection installed')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      operation: 'install',
      nodes: [{ firewall_id: 21, name: 'cluster-node-1', status: 'completed' }],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async installCollection(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecCollectionDto,
  ): Promise<ResponseBuilder> {
    return this.mutateClusterCollections(req, 'install', req.body.name);
  }

  @Validate(CrowdSecCollectionDto)
  @OperationId('Remove CrowdSec collection in cluster')
  @Post('collections/remove')
  @SuccessResponse('200', 'Cluster collection removed')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      operation: 'remove',
      nodes: [{ firewall_id: 21, name: 'cluster-node-1', status: 'completed' }],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async removeCollection(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
    @Body() body?: CrowdSecCollectionDto,
  ): Promise<ResponseBuilder> {
    return this.mutateClusterCollections(req, 'remove', req.body.name);
  }

  @Validate()
  @OperationId('Update CrowdSec collections in cluster')
  @Post('collections/update')
  @SuccessResponse('200', 'Cluster collections updated')
  @Example<CrowdSecClusterApiEnvelopeResponse<CrowdSecClusterCollectionOperationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      completed: true,
      operation: 'update',
      nodes: [{ firewall_id: 21, name: 'cluster-node-1', status: 'completed' }],
    },
  })
  @Response<CrowdSecClusterApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async updateCollections(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() cluster?: number,
  ): Promise<ResponseBuilder> {
    return this.mutateClusterCollections(req, 'update');
  }

  private async mutateClusterCollections(
    req: ExpressRequest,
    operation: ClusterCollectionOperation,
    name?: string,
  ): Promise<ResponseBuilder> {
    const nodes = await this.getAuthorizedNodes(req, false);
    for (const node of nodes) {
      (await CrowdSecPolicy.manage(node, req.session.user)).authorize();
    }

    const collectionNodes = await this.loadClusterCollectionNodes(nodes, name);
    const results: ClusterCollectionNodeResult[] = [];
    const changedNodes: ClusterCollectionNode[] = [];

    for (const node of collectionNodes) {
      if (
        (operation === 'install' && node.installed) ||
        (operation === 'remove' && !node.installed)
      ) {
        results.push({
          firewall_id: node.firewall.id,
          name: node.firewall.name,
          status: 'skipped',
        });
        continue;
      }

      try {
        await this.runClusterCollectionOperation(node.communication, operation, name);
        results.push({
          firewall_id: node.firewall.id,
          name: node.firewall.name,
          status: 'completed',
        });
        if (operation !== 'update') {
          changedNodes.push(node);
        }
      } catch (error) {
        results.push({
          firewall_id: node.firewall.id,
          name: node.firewall.name,
          status: 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec collection operation failed',
        });

        if (operation === 'update') {
          this.appendCancelledCollectionResults(collectionNodes, results);
          return ResponseBuilder.buildResponse().status(200).body({
            completed: false,
            operation,
            manual_reconciliation_required: true,
            nodes: results,
          });
        }

        const rollbackCompleted = await this.rollbackClusterCollectionOperation(
          changedNodes,
          operation,
          name!,
          results,
        );
        this.appendCancelledCollectionResults(collectionNodes, results);
        return ResponseBuilder.buildResponse().status(200).body({
          completed: false,
          operation,
          rollback_completed: rollbackCompleted,
          nodes: results,
        });
      }
    }

    return ResponseBuilder.buildResponse().status(200).body({
      completed: true,
      operation,
      nodes: results,
    });
  }

  private async loadClusterCollectionNodes(
    nodes: Firewall[],
    name?: string,
  ): Promise<ClusterCollectionNode[]> {
    const collectionNodes: ClusterCollectionNode[] = [];
    for (const firewall of nodes) {
      const communication = await CrowdSecLapiSharedService.agentCommunication(firewall, false);
      const collections = await communication.getCrowdSecCollections();
      collectionNodes.push({
        firewall,
        communication,
        installed: name === undefined ? false : this.isCollectionInstalled(collections, name),
      });
    }
    return collectionNodes;
  }

  private isCollectionInstalled(collections: Record<string, unknown>, name: string): boolean {
    const entries = collections.collections;
    return (
      Array.isArray(entries) &&
      entries.some((entry) => {
        if (typeof entry !== 'object' || entry === null) {
          return false;
        }
        const collection = entry as Record<string, unknown>;
        return collection.name === name && collection.state === 'installed';
      })
    );
  }

  private async runClusterCollectionOperation(
    communication: AgentCommunication,
    operation: ClusterCollectionOperation,
    name?: string,
  ): Promise<void> {
    if (operation === 'update') {
      await communication.updateCrowdSecCollections();
      return;
    }
    if (name === undefined) {
      throw new HttpException('CrowdSec collection name is required', 422);
    }
    if (operation === 'install') {
      await communication.installCrowdSecCollection(name);
      return;
    }
    await communication.removeCrowdSecCollection(name);
  }

  private async rollbackClusterCollectionOperation(
    nodes: ClusterCollectionNode[],
    operation: Exclude<ClusterCollectionOperation, 'update'>,
    name: string,
    results: ClusterCollectionNodeResult[],
  ): Promise<boolean> {
    let completed = true;
    const rollbackOperation = operation === 'install' ? 'remove' : 'install';
    for (const node of [...nodes].reverse()) {
      const result = results.find((candidate) => candidate.firewall_id === node.firewall.id);
      if (!result) {
        completed = false;
        continue;
      }
      try {
        await this.runClusterCollectionOperation(node.communication, rollbackOperation, name);
        result.status = 'rolled_back';
      } catch (error) {
        completed = false;
        result.status = 'rollback_failed';
        result.error =
          error instanceof Error
            ? error.message
            : 'CrowdSec collection rollback failed and requires manual recovery';
      }
    }
    return completed;
  }

  private appendCancelledCollectionResults(
    nodes: ClusterCollectionNode[],
    results: ClusterCollectionNodeResult[],
  ): void {
    const processedNodeIds = new Set(results.map((result) => result.firewall_id));
    for (const node of nodes) {
      if (processedNodeIds.has(node.firewall.id)) {
        continue;
      }
      results.push({
        firewall_id: node.firewall.id,
        name: node.firewall.name,
        status: 'cancelled',
        error: 'CrowdSec cluster collection operation was cancelled after a previous node failed',
      });
    }
  }

  private async optionalBouncerApiKey(
    req: ExpressRequest,
    value: unknown,
  ): Promise<string | undefined> {
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

  private async transitionNodesToLapi(req: ExpressRequest): Promise<ResponseBuilder> {
    if (!req.body.localRemediation || req.body.bouncerApiKey !== undefined) {
      throw new HttpException('Invalid CrowdSec cluster role transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req, false);
    const initialNodeStates = await this.captureInitialNodeStates(nodes);
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const results: ClusterMachineNodeResult[] = [];
    const transitionAttempts: ClusterTransitionAttempt[] = [];

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
        transitionAttempts.push({ node, transitionId });
        await communication.activateCrowdSecTransition({ transitionId }, channel);
        activated = true;
        await new CrowdSecInstallationRepository(db.getSource().manager).saveLapiInstallation(
          node.id,
        );
        await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(node, true);
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
          error: error instanceof Error ? error.message : 'CrowdSec cluster node transition failed',
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
          ? 'CrowdSec LAPI transition finished on all cluster nodes'
          : 'CrowdSec LAPI transition finished with node failures',
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

  private async cleanupSourceMachineRegistrations(
    results: ClusterMachineNodeResult[],
    snapshots: Map<number, ClusterCrowdSecNodeSnapshot>,
    lapiService: CrowdSecLapiSharedService,
  ): Promise<void> {
    for (const result of results) {
      const snapshot = snapshots.get(result.firewall_id)?.installation;
      if (snapshot?.machineConnectivityPending) {
        result.source_machine_removed = true;
        result.source_bouncer_cleanup_required = false;
        continue;
      }
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

  private async replicateCentralMachineCredentials(
    lapiService: CrowdSecLapiSharedService,
    replicas: Map<number, CentralLapiNode[]>,
    firewallId: number,
    centralLapiNodes: CentralLapiNode[],
    communication: AgentCommunication,
    machineName: string,
    progress: (message: string) => void,
  ): Promise<void> {
    try {
      await lapiService.replicateMachineCredentials(
        centralLapiNodes,
        communication,
        machineName,
        progress,
      );
      replicas.set(firewallId, centralLapiNodes);
    } catch (error) {
      if (error instanceof CentralLapiReplicationError && error.replicatedNodeIds.length > 0) {
        replicas.set(
          firewallId,
          centralLapiNodes.filter((node) => error.replicatedNodeIds.includes(node.firewall.id)),
        );
      }
      throw error;
    }
  }

  private async replicateCentralBouncer(
    lapiService: CrowdSecLapiSharedService,
    replicas: Map<number, CentralLapiNode[]>,
    firewallId: number,
    centralLapiNodes: CentralLapiNode[],
    name: string,
    apiKey: string,
    progress?: (message: string) => void,
  ): Promise<void> {
    try {
      await lapiService.replicateBouncer(centralLapiNodes, name, apiKey, progress);
      replicas.set(firewallId, centralLapiNodes);
    } catch (error) {
      if (error instanceof CentralLapiReplicationError && error.replicatedNodeIds.length > 0) {
        replicas.set(
          firewallId,
          centralLapiNodes.filter((node) => error.replicatedNodeIds.includes(node.firewall.id)),
        );
      }
      throw error;
    }
  }

  private async cleanupCentralReplicasAfterFailure(
    lapiService: CrowdSecLapiSharedService,
    results: ClusterMachineNodeResult[],
    machineReplicas: Map<number, CentralLapiNode[]>,
    bouncerReplicas: Map<number, CentralLapiNode[]>,
  ): Promise<void> {
    for (const [firewallId, nodes] of machineReplicas) {
      const result = results.find((candidate) => candidate.firewall_id === firewallId);
      if (!result || nodes.length === 0) {
        continue;
      }
      const cleanup = await lapiService.cleanupMachine(nodes, result.machine_name);
      if (!cleanup.completed) {
        result.central_machine_cleanup_required = true;
      }
    }
    for (const [firewallId, nodes] of bouncerReplicas) {
      const result = results.find((candidate) => candidate.firewall_id === firewallId);
      if (!result || nodes.length === 0) {
        continue;
      }
      const cleanup = await lapiService.cleanupBouncer(nodes, result.machine_name);
      if (!cleanup.completed) {
        result.central_bouncer_cleanup_required = true;
      }
    }
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
    req: ExpressRequest,
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

  private async getViewNodes(req: ExpressRequest): Promise<Firewall[]> {
    const nodes = [...this._cluster.firewalls].sort((first, second) => first.id - second.id);
    if (nodes.length === 0) {
      throw new HttpException('CrowdSec cluster has no firewall nodes', 409);
    }
    for (const node of nodes) {
      (await CrowdSecPolicy.view(node, req.session.user)).authorize();
    }
    return nodes;
  }

  private async getSelectedViewNode(req: ExpressRequest): Promise<Firewall> {
    const nodeId = Number(req.query.node_id);
    const node = this._cluster.firewalls.find((candidate) => candidate.id === nodeId);
    if (!node) {
      throw new HttpException('Selected CrowdSec node does not belong to this cluster', 422);
    }
    (await CrowdSecPolicy.view(node, req.session.user)).authorize();
    return node;
  }

  private lapiService(): CrowdSecLapiSharedService {
    return new CrowdSecLapiSharedService(db.getSource().manager, this._cluster.fwCloudId);
  }
}
