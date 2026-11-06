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
import { In } from 'typeorm';
import { AgentCommunication } from '../../../communications/agent.communication';
import { Firewall, FireWallOptMask } from '../../../models/firewall/Firewall';
import { Cluster } from '../../../models/firewall/Cluster';
import { Interface } from '../../../models/interface/Interface';
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
import { CrowdSecClusterLapiConnectivityDto } from './dto/cluster-lapi-connectivity.dto';
import { CrowdSecClusterLapiTopologyInstallDto } from './dto/cluster-lapi-topology-install.dto';
import { CrowdSecConsoleEnrollDto } from './dto/console-enroll.dto';
import { CrowdSecClusterTransitionDto } from './dto/cluster-transition.dto';
import { CrowdSecUninstallDto } from './dto/uninstall.dto';
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
  machine?: Record<string, unknown>;
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

type ClusterLapiConnectivityNodeResult = {
  firewall_id: number;
  name: string;
  reachable: boolean;
  error_code?: string;
  message?: string;
};

type ClusterTopologyMachineAttempt = {
  node: Firewall;
  communication: AgentCommunication;
  machineName: string;
  centralMachineRegistered: boolean;
  centralBouncerRegistered: boolean;
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

    if (req.body.centralFirewallId === undefined) {
      return this.installExternalMachines(req, nodes);
    }
    if (req.body.bouncerApiKey !== undefined) {
      throw new HttpException(
        'CrowdSec Firewall Bouncer API key is only supported with an external Local API',
        422,
      );
    }

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

  @Validate(CrowdSecClusterLapiTopologyInstallDto)
  public async installLapiMaster(req: Request): Promise<ResponseBuilder> {
    const { master, slaves } = await this.getTopologyNodes(req);
    const lapiUrl = CrowdSecLapiSharedService.externalLapiUrl(req.body.lapiUrl);
    await this.assertTopologyLapiUrlBelongsToCluster(lapiUrl, [master, ...slaves]);
    const enrollmentKey =
      req.body.enrollmentKey === undefined
        ? undefined
        : await this.enrollmentKey(req, req.body.enrollmentKey);
    const channel = await Channel.fromRequest(req);
    const lapiService = this.lapiService();
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    const existingMasterInstallation = await installationRepository.findByFirewallId(master.id);

    if (existingMasterInstallation?.mode === CrowdSecInstallationMode.Machine) {
      throw new HttpException('CrowdSec LAPI master cannot be installed over a Machine', 409);
    }

    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Installing CrowdSec LAPI master in cluster'),
    );
    const communication = await CrowdSecLapiSharedService.agentCommunication(master, true);
    if (existingMasterInstallation === null) {
      channel.emit(
        'message',
        new ProgressPayload('info', false, `Installing CrowdSec LAPI on node '${master.name}'`),
      );
      const backend =
        (await Firewall.getCrowdSecFirewallBouncerBackend(master.fwCloudId, master.id)) ??
        'iptables';
      await communication.installCrowdSec(
        channel,
        backend,
        CrowdSecLapiSharedService.managedBouncerNameForCluster(this._cluster),
      );
      await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(master, true);
      await installationRepository.saveLapiInstallation(master.id);
    }

    const masterNode: CentralLapiNode = { firewall: master, communication };
    const progress = (message: string) =>
      channel.emit('message', new ProgressPayload('info', false, message));
    await lapiService.preflight(
      [masterNode],
      CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl),
      progress,
    );
    await lapiService.enable([masterNode]);

    channel.emit(
      'message',
      new ProgressPayload('info', false, 'Checking CrowdSec LAPI connectivity from cluster slaves'),
    );
    const nodes = await this.checkLapiConnectivityForNodes(slaves, lapiUrl);
    const connectivityVerified = nodes.every((node) => node.reachable);
    if (!connectivityVerified) {
      channel.emit(
        'message',
        new ProgressPayload(
          'end',
          true,
          'CrowdSec LAPI master is ready, but one or more cluster slaves cannot reach it',
        ),
      );
      return ResponseBuilder.buildResponse()
        .status(200)
        .body({
          completed: false,
          connectivity_verified: false,
          lapi_master: { firewall_id: master.id, name: master.name, lapi_url: lapiUrl },
          nodes,
        });
    }

    return this.installTopologyMachines(masterNode, slaves, lapiUrl, channel, enrollmentKey);
  }

  private async installTopologyMachines(
    masterNode: CentralLapiNode,
    slaves: Firewall[],
    lapiUrl: string,
    channel: Channel,
    enrollmentKey?: string,
  ): Promise<ResponseBuilder> {
    const { firewall: master } = masterNode;
    const lapiService = this.lapiService();
    const progress = (message: string) =>
      channel.emit('message', new ProgressPayload('info', false, message));
    const results: ClusterMachineNodeResult[] = [];
    const attempts: ClusterTopologyMachineAttempt[] = [];
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    let currentSlave: { node: Firewall; machineName: string } | undefined;
    channel.emit(
      'message',
      new ProgressPayload('info', false, 'Installing CrowdSec Machine slaves in cluster'),
    );
    try {
      for (const slave of slaves) {
        const machineName = CrowdSecLapiSharedService.machineNameForFirewall(slave);
        currentSlave = { node: slave, machineName };
        const existingInstallation = await installationRepository.findByFirewallId(slave.id);
        if (existingInstallation) {
          if (
            existingInstallation.mode === CrowdSecInstallationMode.Machine &&
            existingInstallation.centralFirewallId === master.id &&
            existingInstallation.localRemediation
          ) {
            results.push({
              firewall_id: slave.id,
              name: slave.name,
              machine_name: existingInstallation.machineName ?? machineName,
              status: 'completed',
            });
            continue;
          }
          throw new HttpException(
            'CrowdSec Cluster topology contains an incompatible slave node',
            409,
          );
        }
        const communication = await CrowdSecLapiSharedService.agentCommunication(slave, false);
        const attempt: ClusterTopologyMachineAttempt = {
          node: slave,
          communication,
          machineName,
          centralMachineRegistered: false,
          centralBouncerRegistered: false,
        };
        attempts.push(attempt);
        channel.emit(
          'message',
          new ProgressPayload('info', false, `Installing CrowdSec Machine on node '${slave.name}'`),
        );
        await lapiService.assertCanBecomeMachine(slave, true);
        const backend =
          (await Firewall.getCrowdSecFirewallBouncerBackend(slave.fwCloudId, slave.id)) ??
          'iptables';
        const machine = await communication.installCrowdSecMachine(
          { machineName, lapiUrl },
          channel,
        );
        const installationState = CrowdSecLapiSharedService.machineInstallationState(machine);
        if (
          installationState === 'connectivity_confirmation_required' ||
          installationState === 'pending_connectivity'
        ) {
          throw new HttpException(
            'CrowdSec Machine could not connect to the Cluster LAPI master',
            502,
          );
        }
        await lapiService.replicateMachineCredentials(
          [masterNode],
          communication,
          machineName,
          progress,
        );
        attempt.centralMachineRegistered = true;
        const bouncerApiKey = CrowdSecLapiSharedService.generateBouncerApiKey();
        await lapiService.replicateBouncer([masterNode], machineName, bouncerApiKey, progress);
        attempt.centralBouncerRegistered = true;
        await communication.activateCrowdSecMachine(
          { machineName, localRemediation: true, backend, bouncerApiKey },
          channel,
        );
        await this.persistMachineNode({
          node: slave,
          centralFirewallId: master.id,
          lapiUrl,
          machineName,
          localRemediation: true,
        });
        results.push({
          firewall_id: slave.id,
          name: slave.name,
          machine_name: machineName,
          status: 'completed',
        });
      }
    } catch (error) {
      if (currentSlave && !results.some((result) => result.firewall_id === currentSlave.node.id)) {
        results.push({
          firewall_id: currentSlave.node.id,
          name: currentSlave.node.name,
          machine_name: currentSlave.machineName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec Machine installation failed',
        });
      }
      channel.emit(
        'message',
        new ProgressPayload(
          'end',
          true,
          'CrowdSec Cluster topology installation requires retry or cancellation',
        ),
      );
      return ResponseBuilder.buildResponse()
        .status(200)
        .body({
          completed: false,
          lapi_master: { firewall_id: master.id, name: master.name, lapi_url: lapiUrl },
          nodes: results,
        });
    }

    if (enrollmentKey !== undefined) {
      channel.emit('message', new ProgressPayload('info', false, 'Enrolling CrowdSec Console'));
      try {
        await masterNode.communication.enrollCrowdSecConsole({
          enrollmentKey,
          name: this.consoleInstanceName(master),
        });
        channel.emit(
          'message',
          new ProgressPayload('success', false, 'CrowdSec Console enrollment request completed'),
        );
      } catch {
        channel.emit(
          'message',
          new ProgressPayload(
            'warning',
            false,
            'CrowdSec Cluster topology installation completed successfully, but Console enrollment failed. You can retry enrollment from the Status panel',
          ),
        );
      }
    }

    channel.emit(
      'message',
      new ProgressPayload('end', false, 'CrowdSec Cluster topology installation finished'),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed: true,
        lapi_master: { firewall_id: master.id, name: master.name, lapi_url: lapiUrl },
        nodes: results,
      });
  }

  @Validate(CrowdSecUninstallDto)
  public async cancelLapiMasterTopology(req: Request): Promise<ResponseBuilder> {
    if (!req.body.confirm) {
      throw new HttpException('CrowdSec topology cancellation confirmation is required', 422);
    }
    const { master, slaves } = await this.getTopologyNodes(req);
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    const masterInstallation = await installationRepository.findByFirewallId(master.id);
    if (masterInstallation?.mode !== CrowdSecInstallationMode.Lapi) {
      throw new HttpException('CrowdSec Cluster LAPI master was not found', 409);
    }
    const channel = await Channel.fromRequest(req);
    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Cancelling CrowdSec Cluster topology installation'),
    );
    const communication = await CrowdSecLapiSharedService.agentCommunication(master, true);
    const masterNode: CentralLapiNode = { firewall: master, communication };
    const lapiService = this.lapiService();
    for (const slave of slaves) {
      const installation = await installationRepository.findByFirewallId(slave.id);
      if (!installation) {
        const machineName = CrowdSecLapiSharedService.machineNameForFirewall(slave);
        await lapiService.cleanupBouncer([masterNode], machineName);
        await lapiService.cleanupMachine([masterNode], machineName);
        await (
          await CrowdSecLapiSharedService.agentCommunication(slave, false)
        ).uninstallCrowdSec(true, channel);
        await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(slave, false);
        continue;
      }
      if (
        installation.mode !== CrowdSecInstallationMode.Machine ||
        installation.centralFirewallId !== master.id
      ) {
        throw new HttpException(
          'CrowdSec Cluster topology cancellation found an incompatible slave node',
          409,
        );
      }
      const machineName =
        installation.machineName ?? CrowdSecLapiSharedService.machineNameForFirewall(slave);
      await lapiService.cleanupBouncer([masterNode], machineName);
      await lapiService.cleanupMachine([masterNode], machineName);
      await (
        await CrowdSecLapiSharedService.agentCommunication(slave, false)
      ).uninstallCrowdSec(true, channel);
      await installationRepository.removeByFirewallId(slave.id);
      await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(slave, false);
    }
    await communication.uninstallCrowdSec(true, channel);
    await installationRepository.removeByFirewallId(master.id);
    await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(master, false);
    channel.emit(
      'message',
      new ProgressPayload('end', false, 'CrowdSec Cluster LAPI master was removed'),
    );
    return ResponseBuilder.buildResponse().status(200).body({ completed: true });
  }

  @Validate(CrowdSecClusterLapiConnectivityDto)
  public async checkLapiConnectivity(req: Request): Promise<ResponseBuilder> {
    const nodes = await this.getAuthorizedNodes(req);
    const lapiUrl = CrowdSecLapiSharedService.externalLapiUrl(req.body.lapiUrl);
    const results = await this.checkLapiConnectivityForNodes(nodes, lapiUrl);

    return ResponseBuilder.buildResponse().status(200).body({ nodes: results });
  }

  @Validate(CrowdSecConsoleEnrollDto)
  public async enrollConsole(req: Request): Promise<ResponseBuilder> {
    const nodes = await this.getAuthorizedNodes(req, false);
    const enrollmentKey = await this.enrollmentKey(req, req.body.enrollmentKey);
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    const results: Array<Record<string, unknown>> = [];
    let response: Record<string, unknown> | undefined;

    for (const node of nodes) {
      const installation = await installationRepository.findByFirewallId(node.id);
      if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
        continue;
      }
      response = await (
        await CrowdSecLapiSharedService.agentCommunication(node, true)
      ).enrollCrowdSecConsole({
        enrollmentKey,
        name: this.consoleInstanceName(node),
        tags: req.body.tags,
      });
      await installationRepository.setConsoleEnrollmentConfirmed(node.id, false);
      results.push({ firewall_id: node.id, name: node.name, ...response });
    }

    if (results.length === 0) {
      throw new HttpException('CrowdSec Console enrollment requires a LAPI installation', 409);
    }

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({ ...response, nodes: results });
  }

  private async checkLapiConnectivityForNodes(
    nodes: Firewall[],
    lapiUrl: string,
  ): Promise<ClusterLapiConnectivityNodeResult[]> {
    const results: ClusterLapiConnectivityNodeResult[] = [];
    for (const node of nodes) {
      try {
        const connectivity = await (
          await CrowdSecLapiSharedService.agentCommunication(node, false)
        ).checkCrowdSecLapiConnectivity(lapiUrl);
        results.push({
          firewall_id: node.id,
          name: node.name,
          ...connectivity,
        });
      } catch (error) {
        results.push({
          firewall_id: node.id,
          name: node.name,
          reachable: false,
          error_code: 'FWCLOUD_AGENT_UNREACHABLE',
          message: error instanceof Error ? error.message : 'FWCloud Agent is unavailable',
        });
      }
    }
    return results;
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
      req.body.mode === CrowdSecInstallationMode.Machine &&
      req.body.centralFirewallId === undefined &&
      req.body.lapiUrl !== undefined
    ) {
      return this.installExternalMachines(req, await this.getAuthorizedNodes(req, false));
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
  public async transitionMachineCentralLapi(req: Request): Promise<ResponseBuilder> {
    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }
    if (req.body.mode !== CrowdSecInstallationMode.Machine || req.body.lapiUrl === undefined) {
      throw new HttpException('Invalid CrowdSec cluster central LAPI transition target', 422);
    }

    const nodes = await this.getAuthorizedNodes(req, false);
    if (req.body.centralFirewallId === undefined) {
      return this.moveClusterMachinesToExternalLapi(req, nodes);
    }
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

  private async moveClusterMachinesToExternalLapi(
    req: Request,
    nodes: Firewall[],
  ): Promise<ResponseBuilder> {
    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    const lapiUrl = CrowdSecLapiSharedService.externalLapiUrl(req.body.lapiUrl);
    const channel = await Channel.fromRequest(req);
    const results: ClusterMachineNodeResult[] = [];
    channel.emit(
      'message',
      new ProgressPayload(
        'start',
        false,
        'Moving CrowdSec Machine cluster nodes to an external Local API',
      ),
    );
    await this.runSequentialNodeOperations(nodes, async (node) => {
      const installation = await new CrowdSecInstallationRepository(
        db.getSource().manager,
      ).findByFirewallId(node.id);
      const machineName = installation?.machineName ?? '';
      try {
        if (
          installation?.mode !== CrowdSecInstallationMode.Machine ||
          installation.machineName === null ||
          installation.lapiUrl === null
        ) {
          throw new HttpException('CrowdSec Machine central LAPI transition is not available', 409);
        }
        if (installation.localRemediation && providedBouncerApiKey === undefined) {
          throw new HttpException(
            'CrowdSec Firewall Bouncer API key is required for local remediation',
            422,
          );
        }
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend = installation.localRemediation
          ? ((await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ??
            'iptables')
          : 'iptables';
        channel.emit(
          'message',
          new ProgressPayload('info', false, `Moving CrowdSec Machine on node '${node.name}'`),
        );
        const machine = await communication.installCrowdSecMachine(
          {
            machineName: installation.machineName,
            lapiUrl,
            localRemediation: installation.localRemediation,
            backend,
            ...(providedBouncerApiKey === undefined
              ? {}
              : { bouncerApiKey: providedBouncerApiKey }),
          },
          channel,
        );
        const pendingConnectivity =
          CrowdSecLapiSharedService.machineInstallationState(machine) === 'pending_connectivity';
        await this.persistExternalMachineNode({
          node,
          lapiUrl,
          machineName: installation.machineName,
          localRemediation: installation.localRemediation,
          machineConnectivityPending: pendingConnectivity,
        });
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: installation.machineName,
          machine,
          status: pendingConnectivity ? 'pending_connectivity' : 'completed',
        });
        return true;
      } catch (error) {
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec cluster node transition failed',
        });
        return false;
      }
    });
    const completed = results.every((result) => result.status === 'completed');
    const pendingConnectivity = results.some((result) => result.status === 'pending_connectivity');
    channel.emit(
      'message',
      new ProgressPayload(
        'end',
        !completed,
        completed
          ? 'CrowdSec Machine cluster nodes moved to an external Local API; validate each Machine manually'
          : 'CrowdSec Machine external Local API transition finished with node failures',
      ),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        external_lapi: true,
        ...(pendingConnectivity ? { pending_connectivity: true } : {}),
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
    if (req.body.localRemediation && providedBouncerApiKey === undefined) {
      const installations = await Promise.all(
        nodes.map((node) =>
          new CrowdSecInstallationRepository(db.getSource().manager).findByFirewallId(node.id),
        ),
      );
      if (installations.some((installation) => installation?.centralFirewallId === null)) {
        throw new HttpException(
          'CrowdSec Firewall Bouncer API key is required for local remediation',
          422,
        );
      }
    }
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
          installation.machineName === null ||
          installation.lapiUrl === null ||
          installation.machineConnectivityPending ||
          installation.localRemediation === req.body.localRemediation
        ) {
          throw new HttpException('CrowdSec Machine remediation transition is not available', 409);
        }

        machineName = installation.machineName;
        const externalLapi = installation.centralFirewallId === null;
        const lapiUrl = externalLapi
          ? CrowdSecLapiSharedService.externalLapiUrl(installation.lapiUrl)
          : CrowdSecLapiSharedService.lapiUrl(installation.lapiUrl);
        if (externalLapi && req.body.localRemediation && providedBouncerApiKey === undefined) {
          throw new HttpException(
            'CrowdSec Firewall Bouncer API key is required for local remediation',
            422,
          );
        }
        const centralLapiNodes =
          req.body.localRemediation && !externalLapi
            ? await lapiService.getCentralNodes(
                await lapiService.getCentralFirewall(installation.centralFirewallId as number),
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

        if (req.body.localRemediation && !externalLapi) {
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
        if (bouncerApiKey && !externalLapi) {
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
        if (externalLapi) {
          await this.persistExternalMachineNode({
            node,
            lapiUrl: installation.lapiUrl,
            machineName,
            localRemediation: req.body.localRemediation,
          });
        } else {
          await this.persistMachineNode({
            node,
            centralFirewallId: installation.centralFirewallId as number,
            lapiUrl: installation.lapiUrl,
            machineName,
            localRemediation: req.body.localRemediation,
          });
        }
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'completed',
          ...(!externalLapi && !req.body.localRemediation && installation.localRemediation
            ? { central_bouncer_cleanup_required: true }
            : {}),
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

  @Validate()
  @ValidateQuery(CrowdSecClusterCollectionAcquisitionQueryDto)
  public async collectionAcquisition(req: Request): Promise<ResponseBuilder> {
    const node = await this.getSelectedViewNode(req);
    const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
    const name = req.query.name as string;
    await CrowdSecCollectionAcquisitionService.ensureCollectionInstalled(communication, name);
    const acquisition = await communication.getCrowdSecCollectionAcquisition(name);

    return ResponseBuilder.buildResponse().status(200).body(acquisition);
  }

  @Validate(CrowdSecCollectionAcquisitionUpdateDto)
  @ValidateQuery(CrowdSecClusterCollectionAcquisitionNodeQueryDto)
  public async updateCollectionAcquisition(req: Request): Promise<ResponseBuilder> {
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
  public async selectCollectionAcquisitionParser(req: Request): Promise<ResponseBuilder> {
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
  public async blockingStatisticsSampling(req: Request): Promise<ResponseBuilder> {
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
  public async updateBlockingStatisticsSampling(req: Request): Promise<ResponseBuilder> {
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
  public async blockingStatistics(req: Request): Promise<ResponseBuilder> {
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
  public async blockingStatisticsAddresses(req: Request): Promise<ResponseBuilder> {
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
  public async blockingStatisticsAddressOptions(req: Request): Promise<ResponseBuilder> {
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
  public async installCollection(req: Request): Promise<ResponseBuilder> {
    return this.mutateClusterCollections(req, 'install', req.body.name);
  }

  @Validate(CrowdSecCollectionDto)
  public async removeCollection(req: Request): Promise<ResponseBuilder> {
    return this.mutateClusterCollections(req, 'remove', req.body.name);
  }

  @Validate()
  public async updateCollections(req: Request): Promise<ResponseBuilder> {
    return this.mutateClusterCollections(req, 'update');
  }

  private async mutateClusterCollections(
    req: Request,
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

  private async enrollmentKey(req: Request, value: unknown): Promise<string> {
    if (typeof value !== 'string') {
      throw new HttpException('Invalid CrowdSec enrollment key', 422);
    }
    try {
      const enrollmentKey = (await new PgpHelper(req.session.pgp).decrypt(value)).trim();
      if (
        enrollmentKey.length === 0 ||
        enrollmentKey.length > 512 ||
        Array.from(enrollmentKey).some((character) => {
          const code = character.charCodeAt(0);
          return code < 32 || code === 127;
        })
      ) {
        throw new HttpException('Invalid CrowdSec enrollment key', 422);
      }
      return enrollmentKey;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Invalid CrowdSec enrollment key', 422);
    }
  }

  private consoleInstanceName(firewall: Firewall): string {
    const name = firewall.name?.trim();
    return name && !/[^A-Za-z0-9._-]/.test(name) ? name : firewall.fwCloudId + '-' + firewall.id;
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
          managedBouncerName: CrowdSecLapiSharedService.managedBouncerNameForCluster(this._cluster),
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

  private async installExternalMachines(req: Request, nodes: Firewall[]): Promise<ResponseBuilder> {
    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    if (req.body.localRemediation && providedBouncerApiKey === undefined) {
      throw new HttpException(
        'CrowdSec Firewall Bouncer API key is required for local remediation',
        422,
      );
    }
    if (!req.body.localRemediation && providedBouncerApiKey !== undefined) {
      throw new HttpException(
        'CrowdSec Firewall Bouncer API key is only supported with local remediation',
        422,
      );
    }

    const lapiUrl = CrowdSecLapiSharedService.externalLapiUrl(req.body.lapiUrl);
    const channel = await Channel.fromRequest(req);
    channel.emit(
      'message',
      new ProgressPayload('start', false, 'Installing CrowdSec Machines in cluster nodes'),
    );
    const results: ClusterMachineNodeResult[] = [];
    const completedAllNodes = await this.runSequentialNodeOperations(nodes, async (node) => {
      const machineName = CrowdSecLapiSharedService.machineNameForFirewall(node);
      channel.emit(
        'message',
        new ProgressPayload('info', false, `Installing CrowdSec Machine on node '${node.name}'`),
      );
      try {
        await this.lapiService().assertCanBecomeMachine(node, true);
        const communication = await CrowdSecLapiSharedService.agentCommunication(node, false);
        const backend =
          (await Firewall.getCrowdSecFirewallBouncerBackend(node.fwCloudId, node.id)) ?? 'iptables';
        const machine = await communication.installCrowdSecMachine(
          {
            machineName,
            lapiUrl,
            localRemediation: req.body.localRemediation,
            backend,
            ...(providedBouncerApiKey === undefined
              ? {}
              : { bouncerApiKey: providedBouncerApiKey }),
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
            machine,
            status: 'connectivity_confirmation_required',
          });
          channel.emit(
            'message',
            new ProgressPayload(
              'end',
              false,
              'CrowdSec Machine installation is awaiting external Local API connectivity confirmation',
            ),
          );
          return false;
        }

        const pendingConnectivity =
          CrowdSecLapiSharedService.machineInstallationState(machine) === 'pending_connectivity';
        await this.persistExternalMachineNode({
          node,
          lapiUrl,
          machineName,
          localRemediation: req.body.localRemediation,
          machineConnectivityPending: pendingConnectivity,
        });
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          machine,
          status: pendingConnectivity ? 'pending_connectivity' : 'completed',
        });
        channel.emit(
          'message',
          new ProgressPayload(
            pendingConnectivity ? 'warning' : 'success',
            false,
            pendingConnectivity
              ? `CrowdSec Machine installation on node '${node.name}' is pending external Local API connectivity`
              : `CrowdSec Machine '${machineName}' on node '${node.name}' must be validated manually in the external Local API`,
          ),
        );
      } catch (error) {
        results.push({
          firewall_id: node.id,
          name: node.name,
          machine_name: machineName,
          status: 'failed',
          error: error instanceof Error ? error.message : 'CrowdSec Machine installation failed',
        });
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
      return ResponseBuilder.buildResponse().status(200).body({
        completed: false,
        external_lapi: true,
        connectivity_confirmation_required: true,
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
          ? 'CrowdSec Machine installation finished on all cluster nodes; validate each Machine manually in the external Local API'
          : pendingConnectivity
            ? 'CrowdSec Machine installation is pending external Local API connectivity'
            : 'CrowdSec Machine installation finished with node failures',
      ),
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        completed,
        external_lapi: true,
        ...(pendingConnectivity ? { pending_connectivity: true } : {}),
        nodes: results,
      });
  }

  private async persistExternalMachineNode({
    node,
    lapiUrl,
    machineName,
    localRemediation,
    machineConnectivityPending = false,
  }: {
    node: Firewall;
    lapiUrl: string;
    machineName: string;
    localRemediation: boolean;
    machineConnectivityPending?: boolean;
  }): Promise<void> {
    await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
      node,
      localRemediation,
    );
    await new CrowdSecInstallationRepository(
      db.getSource().manager,
    ).saveExternalMachineInstallation({
      firewallId: node.id,
      lapiUrl,
      machineName,
      localRemediation,
      ...(machineConnectivityPending ? { machineConnectivityPending: true } : {}),
    });
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

  private async getTopologyNodes(req: Request): Promise<{ master: Firewall; slaves: Firewall[] }> {
    const nodes = await this.getAuthorizedNodes(req, false);
    const master = nodes.find((node) => node.fwmaster === 1);
    if (!master) {
      throw new HttpException('CrowdSec Cluster topology requires a master node', 409);
    }
    const slaves = nodes.filter((node) => node.id !== master.id);
    if (slaves.length === 0) {
      throw new HttpException('CrowdSec Cluster topology requires at least one slave node', 409);
    }
    return { master, slaves };
  }

  private async assertTopologyLapiUrlBelongsToCluster(
    lapiUrl: string,
    nodes: Firewall[],
  ): Promise<void> {
    const host = new URL(lapiUrl).hostname.replace(/^\[|\]$/g, '').toLowerCase();
    const interfaces = await db
      .getSource()
      .manager.getRepository(Interface)
      .find({
        where: { firewallId: In(nodes.map((node) => node.id)) },
        relations: ['ipObjs'],
      });
    const belongsToCluster = interfaces.some((networkInterface) =>
      networkInterface.ipObjs.some(
        (ipObj) => ipObj.address.replace(/^\[|\]$/g, '').toLowerCase() === host,
      ),
    );

    if (!belongsToCluster) {
      throw new HttpException(
        'CrowdSec Cluster LAPI URL must use an address from the current cluster',
        422,
      );
    }
  }

  private async rollbackLapiTopology(
    masterNode: CentralLapiNode,
    attempts: ClusterTopologyMachineAttempt[],
    results: ClusterMachineNodeResult[],
    channel: Channel,
  ): Promise<void> {
    const lapiService = this.lapiService();
    const installationRepository = new CrowdSecInstallationRepository(db.getSource().manager);
    for (const attempt of [...attempts].reverse()) {
      const result = results.find((candidate) => candidate.firewall_id === attempt.node.id);
      let rolledBack = true;
      if (attempt.centralBouncerRegistered) {
        const cleanup = await lapiService.cleanupBouncer([masterNode], attempt.machineName);
        rolledBack = cleanup.completed && rolledBack;
      }
      if (attempt.centralMachineRegistered) {
        const cleanup = await lapiService.cleanupMachine([masterNode], attempt.machineName);
        rolledBack = cleanup.completed && rolledBack;
      }
      try {
        await attempt.communication.uninstallCrowdSec(true, channel);
        await installationRepository.removeByFirewallId(attempt.node.id);
        await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
          attempt.node,
          false,
        );
      } catch {
        rolledBack = false;
      }
      if (result) {
        if (!rolledBack) {
          result.status = 'rollback_failed';
          result.error = 'CrowdSec Machine rollback failed and requires manual recovery';
        } else if (result.status !== 'failed') {
          result.status = 'rolled_back';
        }
      }
    }
    try {
      await masterNode.communication.uninstallCrowdSec(true, channel);
      await installationRepository.removeByFirewallId(masterNode.firewall.id);
      await new FirewallRepository(db.getSource().manager).setCrowdSecCompatibility(
        masterNode.firewall,
        false,
      );
    } catch {
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'CrowdSec Cluster LAPI master rollback failed and requires manual recovery',
        ),
      );
    }
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

  private async getViewNodes(req: Request): Promise<Firewall[]> {
    const nodes = [...this._cluster.firewalls].sort((first, second) => first.id - second.id);
    if (nodes.length === 0) {
      throw new HttpException('CrowdSec cluster has no firewall nodes', 409);
    }
    for (const node of nodes) {
      (await CrowdSecPolicy.view(node, req.session.user)).authorize();
    }
    return nodes;
  }

  private async getSelectedViewNode(req: Request): Promise<Firewall> {
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
