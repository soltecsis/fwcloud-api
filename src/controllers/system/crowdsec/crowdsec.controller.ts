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
import * as uuid from 'uuid';
import { AgentCommunication } from '../../../communications/agent.communication';
import { CrowdSecFirewallBackend } from '../../../communications/communication';
import { Validate, ValidateQuery } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../../../models/firewall/Firewall';
import { FirewallRepository } from '../../../models/firewall/firewall.repository';
import { CrowdSecInstallationRepository } from '../../../models/system/crowdsec/crowdsec.repository';
import { CrowdSecPolicy } from '../../../policies/crowdsec.policy';
import { Channel } from '../../../sockets/channels/channel';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import db from '../../../database/database-manager';
import { CrowdSecCollectionsQueryDto } from './dto/collections-query.dto';
import { CrowdSecAlertsQueryDto } from './dto/alerts-query.dto';
import { CrowdSecBouncerDto } from './dto/bouncer.dto';
import { CrowdSecCollectionDto } from './dto/collection.dto';
import { CrowdSecConsoleEnrollDto } from './dto/console-enroll.dto';
import { CrowdSecDecisionsFlushDto } from './dto/decisions-flush.dto';
import { CrowdSecDecisionsQueryDto } from './dto/decisions-query.dto';
import { CrowdSecUninstallDto } from './dto/uninstall.dto';
import { CrowdSecMachineInstallDto } from './dto/machine-install.dto';
import { CrowdSecTransitionDto } from './dto/transition.dto';
import { CrowdSecCentralLapiConfigureDto } from './dto/central-lapi-configure.dto';
import { PgpHelper } from '../../../utils/pgp';
import { CrowdSecInstallationMode } from '../../../models/system/crowdsec/crowdsec-installation.model';

export class CrowdSecController extends Controller {
  protected _firewall: Firewall;

  public async make(request: Request): Promise<void> {
    const firewallId = Number(request.params.firewall);
    const fwcloudId = Number(request.params.fwcloud);

    if (
      !Number.isInteger(firewallId) ||
      firewallId < 1 ||
      !Number.isInteger(fwcloudId) ||
      fwcloudId < 1
    ) {
      throw new HttpException('Invalid firewall context', 400);
    }

    this._firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: firewallId, fwCloudId: fwcloudId } });
  }

  @Validate()
  public async status(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();
    const status = await (await this.getAgentCommunication()).getCrowdSecStatus();
    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    const centralLapiEnabled = installation?.centralLapiEnabled === true;
    const centralLapiHasMachines =
      centralLapiEnabled &&
      (await this.getCrowdSecInstallationRepository().hasMachineDependents(this._firewall.id));
    const lapiState = (status.lapi as Record<string, unknown> | undefined)?.state;
    const machineReauthenticationRequired =
      installation?.mode === CrowdSecInstallationMode.Machine &&
      lapiState === 'reauthentication_required';
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        ...status,
        central_lapi_enabled: centralLapiEnabled,
        central_lapi_has_machines: centralLapiHasMachines,
        machine_reauthentication_required: machineReauthenticationRequired,
        machine_connectivity_pending: installation?.machineConnectivityPending === true,
        installation_mode: installation?.mode ?? null,
        local_remediation: installation?.localRemediation ?? false,
        central_lapi_firewall_id: installation?.centralFirewallId ?? null,
        central_lapi_url: installation?.lapiUrl ?? null,
        machine_name: installation?.machineName ?? null,
      });
  }

  @Validate()
  @ValidateQuery(CrowdSecCollectionsQueryDto)
  public async collections(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const installed =
      req.query.installed === undefined ? undefined : req.query.installed === 'true';
    const collections = await (
      await this.getAgentCommunication()
    ).getCrowdSecCollections(installed);

    return ResponseBuilder.buildResponse().status(200).body(collections);
  }

  @Validate()
  public async consoleStatus(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const status = await (await this.getAgentCommunication()).getCrowdSecConsoleStatus();
    return ResponseBuilder.buildResponse().status(200).body(status);
  }

  @Validate()
  @ValidateQuery(CrowdSecDecisionsQueryDto)
  public async decisions(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const decisions = await (
      await this.getAgentCommunication()
    ).getCrowdSecDecisions({
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
      scope: req.query.scope as string | undefined,
      value: req.query.value as string | undefined,
      decisionType: req.query.decision_type as string | undefined,
      origin: req.query.origin as string | undefined,
      scenario: req.query.scenario as string | undefined,
    });

    return ResponseBuilder.buildResponse().status(200).body(decisions);
  }

  @Validate()
  @ValidateQuery(CrowdSecAlertsQueryDto)
  public async alerts(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const alerts = await (
      await this.getAgentCommunication()
    ).getCrowdSecAlerts({
      limit: req.query.limit === undefined ? undefined : Number(req.query.limit),
      since: req.query.since as string | undefined,
      until: req.query.until as string | undefined,
      scenario: req.query.scenario as string | undefined,
      decisionType: req.query.type as string | undefined,
      scope: req.query.scope as string | undefined,
      value: req.query.value as string | undefined,
      ip: req.query.ip as string | undefined,
      range: req.query.range as string | undefined,
    });

    return ResponseBuilder.buildResponse().status(200).body(alerts);
  }

  @Validate()
  public async bouncers(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const bouncers = await (await this.getAgentCommunication()).getCrowdSecBouncers();
    return ResponseBuilder.buildResponse().status(200).body(bouncers);
  }

  @Validate()
  public async machines(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const machines = await (await this.getAgentCommunication()).getCrowdSecLapiMachines();
    return ResponseBuilder.buildResponse().status(200).body(machines);
  }

  @Validate()
  public async centralLapiCandidates(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const candidates = await this.getCrowdSecInstallationRepository().findCentralCandidates(
      this._firewall.fwCloudId,
      this._firewall.id,
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        candidates: candidates.map(({ firewall }) => ({ id: firewall.id, name: firewall.name })),
      });
  }

  @Validate(CrowdSecCentralLapiConfigureDto)
  public async configureCentralLapi(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (installation?.mode !== CrowdSecInstallationMode.Standalone) {
      throw new HttpException(
        'CrowdSec Local API requires a standalone CrowdSec installation',
        409,
      );
    }

    const centralLapiEnabled = this.isCentralLapiListener(req.body.listenUri);
    if (
      !centralLapiEnabled &&
      (await this.getCrowdSecInstallationRepository().hasMachineDependents(this._firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec central Local API has dependent machines and cannot be disabled',
        409,
      );
    }

    const result = await (
      await this.getAgentCommunication()
    ).configureCrowdSecCentralLapi(req.body.listenUri);
    await this.getCrowdSecInstallationRepository().setCentralLapiEnabled(
      this._firewall.id,
      centralLapiEnabled,
    );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({ ...result, central_lapi_enabled: centralLapiEnabled });
  }

  @Validate()
  public async validateMachine(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const machine = await (
      await this.getAgentCommunication()
    ).validateCrowdSecLapiMachine(this.machineName(req.params.machine));
    return ResponseBuilder.buildResponse().status(200).body(machine);
  }

  @Validate()
  public async removeMachine(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const machineName = this.machineName(req.params.machine);
    const machine = await (
      await this.getAgentCommunication()
    ).removeCrowdSecLapiMachine(machineName);

    return ResponseBuilder.buildResponse().status(200).body(machine);
  }

  @Validate()
  public async reauthenticateMachine(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (
      installation?.mode !== CrowdSecInstallationMode.Machine ||
      installation.centralFirewallId === null ||
      installation.machineName === null ||
      installation.lapiUrl === null
    ) {
      throw new HttpException('CrowdSec Machine installation was not found', 409);
    }

    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    if (installation.machineConnectivityPending) {
      await centralCommunication.ping();
      await centralCommunication.configureCrowdSecCentralLapi(
        this.listenerUriForLapiUrl(installation.lapiUrl),
      );
    }
    const machine = await remoteCommunication.reauthenticateCrowdSecMachine({
      machineName: installation.machineName,
      lapiUrl: installation.lapiUrl,
    });
    const validation = await centralCommunication.validateCrowdSecLapiMachine(
      installation.machineName,
    );
    const activation = installation.machineConnectivityPending
      ? await remoteCommunication.activateCrowdSecMachine({
          machineName: installation.machineName,
          localRemediation: installation.localRemediation,
          backend: installation.localRemediation
            ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
                this._firewall.fwCloudId,
                this._firewall.id,
              )) ?? 'iptables')
            : 'iptables',
          ...(installation.localRemediation
            ? {
                bouncerApiKey: this.bouncerApiKey(
                  await centralCommunication.registerCrowdSecBouncer(installation.machineName),
                ),
              }
            : {}),
        })
      : await remoteCommunication.resumeCrowdSecMachine(
          installation.machineName,
          installation.localRemediation,
        );
    await this.getCrowdSecInstallationRepository().setMachineConnectivityPending(
      this._firewall.id,
      false,
    );

    return ResponseBuilder.buildResponse().status(200).body({ machine, validation, activation });
  }

  @Validate(CrowdSecMachineInstallDto)
  public async installMachine(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    await this.assertCanTransitionStandaloneToMachine();

    const centralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
    const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const lapiUrl = this.lapiUrl(req.body.lapiUrl);
    const channel = await Channel.fromRequest(req);

    channel.emit('message', new ProgressPayload('start', false, 'Installing CrowdSec machine'));

    let centralLapiAgentAvailable = true;
    try {
      await centralCommunication.ping();
      await centralCommunication.configureCrowdSecCentralLapi(this.listenerUriForLapiUrl(lapiUrl));
    } catch {
      centralLapiAgentAvailable = false;
      if (req.body.continueWithoutLapiConnectivity !== true) {
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
        return ResponseBuilder.buildResponse()
          .status(200)
          .body({
            machine: { installation_state: 'connectivity_confirmation_required' },
            connectivity_confirmation_required: true,
            connectivity_confirmation_reason: 'central_agent_unreachable',
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
    const machine = await remoteCommunication.installCrowdSecMachine(
      {
        machineName: req.body.machineName,
        lapiUrl,
        ...(req.body.continueWithoutLapiConnectivity === true
          ? { continueWithoutLapiConnectivity: true }
          : {}),
      },
      channel,
    );

    if (this.machineInstallationState(machine) === 'connectivity_confirmation_required') {
      channel.emit(
        'message',
        new ProgressPayload(
          'warning',
          false,
          'CrowdSec Machine installation requires confirmation because the central Local API is unreachable',
        ),
      );
      return ResponseBuilder.buildResponse().status(200).body({
        machine,
        connectivity_confirmation_required: true,
      });
    }

    if (centralLapiAgentAvailable) {
      await this.getCrowdSecInstallationRepository().setCentralLapiEnabled(
        centralFirewall.id,
        true,
      );
    }
    if (this.machineInstallationState(machine) === 'pending_connectivity') {
      this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
        this._firewall,
        true,
      );
      await this.getCrowdSecInstallationRepository().saveMachineInstallation({
        firewallId: this._firewall.id,
        centralFirewallId: centralFirewall.id,
        lapiUrl,
        machineName: req.body.machineName,
        localRemediation: req.body.localRemediation,
        machineConnectivityPending: true,
      });
      channel.emit(
        'message',
        new ProgressPayload(
          'end',
          false,
          'CrowdSec Machine installation is pending central Local API connectivity',
        ),
      );
      return ResponseBuilder.buildResponse().status(200).body({
        machine,
        pending_connectivity: true,
      });
    }

    try {
      const validation = await centralCommunication.validateCrowdSecLapiMachine(
        req.body.machineName,
      );
      const providedBouncerApiKey = this.optionalBouncerApiKey(req.body.bouncerApiKey);
      const bouncerApiKey = req.body.localRemediation
        ? (providedBouncerApiKey ??
          this.bouncerApiKey(
            await centralCommunication.registerCrowdSecBouncer(
              this.machineName(req.body.machineName),
            ),
          ))
        : undefined;
      const backend = req.body.localRemediation
        ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
            this._firewall.fwCloudId,
            this._firewall.id,
          )) ?? 'iptables')
        : 'iptables';
      const activation = await remoteCommunication.activateCrowdSecMachine(
        {
          machineName: req.body.machineName,
          localRemediation: req.body.localRemediation,
          backend,
          bouncerApiKey,
        },
        channel,
      );

      this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
        this._firewall,
        true,
      );
      await this.getCrowdSecInstallationRepository().saveMachineInstallation({
        firewallId: this._firewall.id,
        centralFirewallId: centralFirewall.id,
        lapiUrl,
        machineName: req.body.machineName,
        localRemediation: req.body.localRemediation,
      });

      channel.emit(
        'message',
        new ProgressPayload('end', false, 'CrowdSec machine installation finished'),
      );

      return ResponseBuilder.buildResponse().status(200).body({ machine, validation, activation });
    } catch (error) {
      try {
        await centralCommunication.removeCrowdSecLapiMachine(req.body.machineName);
      } catch {
        // The primary installation error is more useful than a failed Machine cleanup.
      }

      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  public async transitionMachineAddress(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (
      installation?.mode !== CrowdSecInstallationMode.Machine ||
      installation.centralFirewallId === null ||
      installation.machineName === null ||
      installation.lapiUrl === null
    ) {
      throw new HttpException('CrowdSec Machine installation was not found', 409);
    }
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId !== installation.centralFirewallId ||
      req.body.machineName !== installation.machineName ||
      req.body.localRemediation !== installation.localRemediation
    ) {
      throw new HttpException(
        'This endpoint only supports a CrowdSec Machine address change within the current central Local API',
        422,
      );
    }

    const lapiUrl = this.lapiUrl(req.body.lapiUrl);
    if (lapiUrl === installation.lapiUrl) {
      return ResponseBuilder.buildResponse().status(200).body({
        changed: false,
        message: 'CrowdSec Local API address is unchanged',
      });
    }

    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const channel = await Channel.fromRequest(req);
    const previousListenerUri = this.listenerUriForLapiUrl(installation.lapiUrl);
    const targetListenerUri = this.listenerUriForLapiUrl(lapiUrl);
    const listenerChangeRequired = previousListenerUri !== targetListenerUri;
    if (
      listenerChangeRequired &&
      (await this.getCrowdSecInstallationRepository().hasOtherMachineDependents(
        installation.centralFirewallId,
        this._firewall.id,
      ))
    ) {
      throw new HttpException(
        'CrowdSec central Local API port cannot be changed while other Machines are connected',
        409,
      );
    }
    const backend = installation.localRemediation
      ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
          this._firewall.fwCloudId,
          this._firewall.id,
        )) ?? 'iptables')
      : undefined;
    const transitionId = uuid.v4();
    const transition = {
      transitionId,
      confirm: true,
      expected: {
        mode: 'machine' as const,
        localRemediation: installation.localRemediation,
        machineName: installation.machineName,
        lapiUrl: installation.lapiUrl,
      },
      target: {
        mode: 'machine' as const,
        localRemediation: installation.localRemediation,
        machineName: installation.machineName,
        lapiUrl,
      },
      authorityChanged: false,
      backend,
    };

    let listenerChanged = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Changing CrowdSec Local API address'),
      );
      if (listenerChangeRequired) {
        channel.emit(
          'message',
          new ProgressPayload('info', false, 'Reconfiguring CrowdSec central Local API listener'),
        );
        await centralCommunication.configureCrowdSecCentralLapi(targetListenerUri);
        listenerChanged = true;
        await this.getCrowdSecInstallationRepository().setCentralLapiEnabled(
          centralFirewall.id,
          true,
        );
      }
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      const activation = await remoteCommunication.activateCrowdSecTransition(
        { transitionId },
        channel,
      );
      await this.getCrowdSecInstallationRepository().saveMachineInstallation({
        firewallId: this._firewall.id,
        centralFirewallId: installation.centralFirewallId,
        lapiUrl,
        machineName: installation.machineName,
        localRemediation: installation.localRemediation,
      });
      const finalization = await remoteCommunication.finalizeCrowdSecTransition(transitionId);
      channel.emit(
        'message',
        new ProgressPayload('end', false, 'CrowdSec Local API address changed'),
      );

      return ResponseBuilder.buildResponse().status(200).body({
        changed: true,
        preparation,
        activation,
        finalization,
      });
    } catch (error) {
      if (listenerChanged) {
        try {
          await centralCommunication.configureCrowdSecCentralLapi(previousListenerUri);
        } catch {
          // The original failure is more useful than a failed listener rollback.
        }
      }
      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  public async transitionMachineCentralLapi(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (
      installation?.mode !== CrowdSecInstallationMode.Machine ||
      installation.centralFirewallId === null ||
      installation.machineName === null ||
      installation.lapiUrl === null
    ) {
      throw new HttpException('CrowdSec Machine installation was not found', 409);
    }
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId === installation.centralFirewallId ||
      req.body.machineName !== installation.machineName ||
      req.body.localRemediation !== installation.localRemediation
    ) {
      throw new HttpException(
        'This endpoint only supports moving a CrowdSec Machine to a different central Local API',
        422,
      );
    }

    const lapiUrl = this.lapiUrl(req.body.lapiUrl);
    const targetCentralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
    const targetCentralCommunication =
      await this.getCentralAgentCommunication(targetCentralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const channel = await Channel.fromRequest(req);
    const backend = installation.localRemediation
      ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
          this._firewall.fwCloudId,
          this._firewall.id,
        )) ?? 'iptables')
      : undefined;
    const transitionId = uuid.v4();

    await targetCentralCommunication.configureCrowdSecCentralLapi(
      this.listenerUriForLapiUrl(lapiUrl),
    );
    await this.getCrowdSecInstallationRepository().setCentralLapiEnabled(
      targetCentralFirewall.id,
      true,
    );

    const transition = {
      transitionId,
      confirm: true,
      expected: {
        mode: 'machine' as const,
        localRemediation: installation.localRemediation,
        machineName: installation.machineName,
        lapiUrl: installation.lapiUrl,
      },
      target: {
        mode: 'machine' as const,
        localRemediation: installation.localRemediation,
        machineName: installation.machineName,
        lapiUrl,
      },
      authorityChanged: true,
      backend,
    };
    let prepared = false;
    let activated = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Moving CrowdSec Machine to a new Local API'),
      );
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      prepared = true;
      const validation = await targetCentralCommunication.validateCrowdSecLapiMachine(
        installation.machineName,
      );
      const providedBouncerApiKey = this.optionalBouncerApiKey(req.body.bouncerApiKey);
      const bouncerApiKey = installation.localRemediation
        ? (providedBouncerApiKey ??
          this.bouncerApiKey(
            await targetCentralCommunication.registerCrowdSecBouncer(installation.machineName),
          ))
        : undefined;
      const activation = await remoteCommunication.activateCrowdSecTransition(
        { transitionId, bouncerApiKey },
        channel,
      );
      activated = true;
      await this.getCrowdSecInstallationRepository().saveMachineInstallation({
        firewallId: this._firewall.id,
        centralFirewallId: targetCentralFirewall.id,
        lapiUrl,
        machineName: installation.machineName,
        localRemediation: installation.localRemediation,
      });
      const finalization = await remoteCommunication.finalizeCrowdSecTransition(transitionId);
      let sourceMachineRemoved = true;
      try {
        const sourceCentralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
        const sourceCentralCommunication =
          await this.getCentralAgentCommunication(sourceCentralFirewall);
        try {
          await sourceCentralCommunication.removeCrowdSecLapiMachine(installation.machineName);
        } catch {
          sourceMachineRemoved = false;
        }
      } catch {
        sourceMachineRemoved = false;
      }
      channel.emit(
        'message',
        new ProgressPayload('end', false, 'CrowdSec Machine moved to the new Local API'),
      );

      return ResponseBuilder.buildResponse().status(200).body({
        changed: true,
        preparation,
        validation,
        activation,
        finalization,
        source_machine_removed: sourceMachineRemoved,
        source_bouncer_cleanup_required: installation.localRemediation,
      });
    } catch (error) {
      if (!activated && prepared) {
        try {
          await remoteCommunication.recoverCrowdSecTransition(transitionId);
        } catch {
          // The agent preserves recovery state when restoring the previous Machine configuration fails.
        }
        try {
          await targetCentralCommunication.removeCrowdSecLapiMachine(installation.machineName);
        } catch {
          // The primary transition error is more useful than a failed Machine cleanup.
        }
      }

      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  public async transitionMachineRemediation(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (
      installation?.mode !== CrowdSecInstallationMode.Machine ||
      installation.centralFirewallId === null ||
      installation.machineName === null ||
      installation.lapiUrl === null
    ) {
      throw new HttpException('CrowdSec Machine installation was not found', 409);
    }
    const lapiUrl = this.lapiUrl(req.body.lapiUrl);
    if (
      req.body.mode !== CrowdSecInstallationMode.Machine ||
      req.body.centralFirewallId !== installation.centralFirewallId ||
      req.body.machineName !== installation.machineName ||
      lapiUrl !== installation.lapiUrl ||
      req.body.localRemediation === installation.localRemediation
    ) {
      throw new HttpException(
        'This endpoint only supports changing CrowdSec Machine local remediation',
        422,
      );
    }

    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const channel = await Channel.fromRequest(req);
    const backend = req.body.localRemediation
      ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
          this._firewall.fwCloudId,
          this._firewall.id,
        )) ?? 'iptables')
      : undefined;
    const transitionId = uuid.v4();
    const transition = {
      transitionId,
      confirm: true,
      expected: {
        mode: 'machine' as const,
        localRemediation: installation.localRemediation,
        machineName: installation.machineName,
        lapiUrl: installation.lapiUrl,
      },
      target: {
        mode: 'machine' as const,
        localRemediation: req.body.localRemediation,
        machineName: installation.machineName,
        lapiUrl,
      },
      authorityChanged: false,
      backend,
    };
    let prepared = false;
    let activated = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Changing CrowdSec local remediation'),
      );
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      prepared = true;
      const providedBouncerApiKey = this.optionalBouncerApiKey(req.body.bouncerApiKey);
      const bouncerApiKey = req.body.localRemediation
        ? (providedBouncerApiKey ??
          this.bouncerApiKey(
            await centralCommunication.registerCrowdSecBouncer(installation.machineName),
          ))
        : undefined;
      const activation = await remoteCommunication.activateCrowdSecTransition(
        { transitionId, bouncerApiKey },
        channel,
      );
      activated = true;
      await this.getCrowdSecInstallationRepository().saveMachineInstallation({
        firewallId: this._firewall.id,
        centralFirewallId: installation.centralFirewallId,
        lapiUrl: installation.lapiUrl,
        machineName: installation.machineName,
        localRemediation: req.body.localRemediation,
      });
      const finalization = await remoteCommunication.finalizeCrowdSecTransition(transitionId);
      channel.emit(
        'message',
        new ProgressPayload('end', false, 'CrowdSec local remediation changed'),
      );

      return ResponseBuilder.buildResponse()
        .status(200)
        .body({
          changed: true,
          preparation,
          activation,
          finalization,
          central_bouncer_cleanup_required:
            !req.body.localRemediation && installation.localRemediation,
        });
    } catch (error) {
      if (prepared && req.body.localRemediation && !activated) {
        try {
          await remoteCommunication.recoverCrowdSecTransition(transitionId);
        } catch {
          // The agent preserves recovery state when restoring the previous Machine configuration fails.
        }
      }

      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  public async transitionCrowdSecRole(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    if (!req.body.confirm) {
      throw new HttpException('CrowdSec transition confirmation is required', 422);
    }

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (!installation) {
      throw new HttpException('CrowdSec installation topology was not found', 409);
    }
    if (installation.mode === req.body.mode) {
      throw new HttpException(
        'CrowdSec role transition requires a different installation mode',
        422,
      );
    }

    const remoteCommunication = await this.getAgentCommunication();
    const channel = await Channel.fromRequest(req);
    const transitionId = uuid.v4();

    if (installation.mode === CrowdSecInstallationMode.Standalone) {
      if (req.body.mode !== CrowdSecInstallationMode.Machine) {
        throw new HttpException('Invalid CrowdSec role transition target', 422);
      }
      await this.assertCanTransitionStandaloneToMachine();

      const centralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
      const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
      const lapiUrl = this.lapiUrl(req.body.lapiUrl);
      const backend = req.body.localRemediation
        ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
            this._firewall.fwCloudId,
            this._firewall.id,
          )) ?? 'iptables')
        : undefined;
      await centralCommunication.configureCrowdSecCentralLapi(this.listenerUriForLapiUrl(lapiUrl));
      await this.getCrowdSecInstallationRepository().setCentralLapiEnabled(
        centralFirewall.id,
        true,
      );
      const transition = {
        transitionId,
        confirm: true,
        expected: {
          mode: 'standalone' as const,
          localRemediation: true,
        },
        target: {
          mode: 'machine' as const,
          localRemediation: req.body.localRemediation,
          machineName: req.body.machineName,
          lapiUrl,
        },
        authorityChanged: true,
        backend,
      };
      let prepared = false;
      let activated = false;
      try {
        channel.emit(
          'message',
          new ProgressPayload(
            'start',
            false,
            'Converting CrowdSec standalone installation to Machine',
          ),
        );
        const preparation = await remoteCommunication.prepareCrowdSecTransition(
          transition,
          channel,
        );
        prepared = true;
        const validation = await centralCommunication.validateCrowdSecLapiMachine(
          req.body.machineName,
        );
        const providedBouncerApiKey = this.optionalBouncerApiKey(req.body.bouncerApiKey);
        const bouncerApiKey = req.body.localRemediation
          ? (providedBouncerApiKey ??
            this.bouncerApiKey(
              await centralCommunication.registerCrowdSecBouncer(req.body.machineName),
            ))
          : undefined;
        const activation = await remoteCommunication.activateCrowdSecTransition(
          { transitionId, bouncerApiKey },
          channel,
        );
        activated = true;
        await this.getCrowdSecInstallationRepository().saveMachineInstallation({
          firewallId: this._firewall.id,
          centralFirewallId: centralFirewall.id,
          lapiUrl,
          machineName: req.body.machineName,
          localRemediation: req.body.localRemediation,
        });
        const finalization = await remoteCommunication.finalizeCrowdSecTransition(transitionId);
        channel.emit(
          'message',
          new ProgressPayload('end', false, 'CrowdSec Machine transition finished'),
        );

        return ResponseBuilder.buildResponse().status(200).body({
          changed: true,
          preparation,
          validation,
          activation,
          finalization,
        });
      } catch (error) {
        if (!activated && prepared) {
          try {
            await remoteCommunication.recoverCrowdSecTransition(transitionId);
          } catch {
            // The agent preserves a recovery state when the former standalone role cannot be restored.
          }
          try {
            await centralCommunication.removeCrowdSecLapiMachine(req.body.machineName);
          } catch {
            // The primary transition error is more useful than a failed central Machine cleanup.
          }
        }
        throw error;
      }
    }

    if (
      installation.mode !== CrowdSecInstallationMode.Machine ||
      installation.centralFirewallId === null ||
      installation.machineName === null ||
      installation.lapiUrl === null ||
      req.body.mode !== CrowdSecInstallationMode.Standalone ||
      !req.body.localRemediation ||
      req.body.bouncerApiKey !== undefined
    ) {
      throw new HttpException('Invalid CrowdSec role transition target', 422);
    }

    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
    const backend =
      (await Firewall.getCrowdSecFirewallBouncerBackend(
        this._firewall.fwCloudId,
        this._firewall.id,
      )) ?? 'iptables';
    const transition = {
      transitionId,
      confirm: true,
      expected: {
        mode: 'machine' as const,
        localRemediation: installation.localRemediation,
        machineName: installation.machineName,
        lapiUrl: installation.lapiUrl,
      },
      target: {
        mode: 'standalone' as const,
        localRemediation: true,
      },
      authorityChanged: true,
      backend,
    };
    let prepared = false;
    let activated = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Restoring CrowdSec standalone installation'),
      );
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      prepared = true;
      const activation = await remoteCommunication.activateCrowdSecTransition(
        { transitionId },
        channel,
      );
      activated = true;
      await this.getCrowdSecInstallationRepository().saveStandaloneInstallation(this._firewall.id);
      const finalization = await remoteCommunication.finalizeCrowdSecTransition(transitionId);
      let sourceMachineRemoved = true;
      try {
        await centralCommunication.removeCrowdSecLapiMachine(installation.machineName);
      } catch {
        sourceMachineRemoved = false;
      }
      channel.emit(
        'message',
        new ProgressPayload('end', false, 'CrowdSec standalone transition finished'),
      );

      return ResponseBuilder.buildResponse().status(200).body({
        changed: true,
        preparation,
        activation,
        finalization,
        source_machine_removed: sourceMachineRemoved,
        source_bouncer_cleanup_required: installation.localRemediation,
      });
    } catch (error) {
      if (prepared && !activated) {
        try {
          await remoteCommunication.recoverCrowdSecTransition(transitionId);
        } catch {
          // The agent preserves a recovery state when restoring the former Machine role fails.
        }
      }
      throw error;
    }
  }

  @Validate(CrowdSecBouncerDto)
  public async registerBouncer(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const bouncer = await (
      await this.getAgentCommunication()
    ).registerCrowdSecBouncer(this.bouncerName(req.body.name));
    const apiKey = bouncer.api_key;
    const pgp = new PgpHelper({ public: req.session.uiPublicKey, private: '' });
    const protectedBouncer =
      typeof apiKey === 'string'
        ? {
            ...bouncer,
            api_key: await pgp.encrypt(apiKey),
          }
        : bouncer;

    return ResponseBuilder.buildResponse().status(200).body(protectedBouncer);
  }

  @Validate()
  public async removeBouncer(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const bouncer = await (
      await this.getAgentCommunication()
    ).removeCrowdSecBouncer(this.bouncerName(req.params.bouncer));
    return ResponseBuilder.buildResponse().status(200).body(bouncer);
  }

  @Validate()
  public async deleteDecision(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const decision = await (
      await this.getAgentCommunication()
    ).deleteCrowdSecDecision(this.decisionId(req));
    return ResponseBuilder.buildResponse().status(200).body(decision);
  }

  @Validate(CrowdSecDecisionsFlushDto)
  public async flushDecisions(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const decisions = await (
      await this.getAgentCommunication()
    ).flushCrowdSecDecisions(req.body.confirm);
    return ResponseBuilder.buildResponse().status(200).body(decisions);
  }

  @Validate(CrowdSecConsoleEnrollDto)
  public async enrollConsole(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const response = await (await this.getAgentCommunication()).enrollCrowdSecConsole(req.body);
    return ResponseBuilder.buildResponse().status(200).body(response);
  }

  @Validate(CrowdSecCollectionDto)
  public async installCollection(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const result = await communication.installCrowdSecCollection(req.body.name);
    const collections = await communication.getCrowdSecCollections();

    return ResponseBuilder.buildResponse().status(200).body({ result, collections });
  }

  @Validate(CrowdSecCollectionDto)
  public async removeCollection(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const result = await communication.removeCrowdSecCollection(req.body.name);
    const collections = await communication.getCrowdSecCollections();

    return ResponseBuilder.buildResponse().status(200).body({ result, collections });
  }

  @Validate()
  public async updateCollections(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const result = await communication.updateCrowdSecCollections();
    const collections = await communication.getCrowdSecCollections();

    return ResponseBuilder.buildResponse().status(200).body({ result, collections });
  }

  @Validate()
  public async install(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const channel = await Channel.fromRequest(req);
    const { communication, backend } = await this.getCrowdSecInstallContext();
    channel.emit('message', new ProgressPayload('start', false, 'Installing CrowdSec'));

    const crowdsec = await communication.installCrowdSec(channel, backend);
    this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
      this._firewall,
      true,
    );
    await this.getCrowdSecInstallationRepository().saveStandaloneInstallation(this._firewall.id);

    channel.emit('message', new ProgressPayload('end', false, 'CrowdSec installation finished'));

    return ResponseBuilder.buildResponse().status(200).body({ crowdsec });
  }

  @Validate(CrowdSecUninstallDto)
  public async uninstall(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    const centralBouncerCleanupRequired =
      installation?.mode === CrowdSecInstallationMode.Machine &&
      installation.localRemediation &&
      !installation.machineConnectivityPending;
    if (
      installation?.mode === CrowdSecInstallationMode.Standalone &&
      (await this.getCrowdSecInstallationRepository().hasMachineDependents(this._firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec standalone Local API has dependent machines and cannot be uninstalled',
        409,
      );
    }

    const communication = await this.getAgentCommunication();
    await communication.ping();

    const channel = await Channel.fromRequest(req);
    let centralMachineCleanupRequired = false;
    channel.emit('message', new ProgressPayload('start', false, 'Uninstalling CrowdSec'));

    if (
      installation?.mode === CrowdSecInstallationMode.Machine &&
      installation.centralFirewallId !== null &&
      installation.machineName !== null &&
      !installation.machineConnectivityPending
    ) {
      try {
        const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
        const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
        await centralCommunication.removeCrowdSecLapiMachine(installation.machineName);
      } catch {
        centralMachineCleanupRequired = true;
        channel.emit(
          'message',
          new ProgressPayload(
            'warning',
            false,
            'CrowdSec Machine could not be removed from its central Local API and must be removed manually when it is reachable',
          ),
        );
      }
    }

    const result = await communication.uninstallCrowdSec(req.body.confirm, channel);
    this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
      this._firewall,
      false,
    );
    await this.getCrowdSecInstallationRepository().removeByFirewallId(this._firewall.id);

    channel.emit('message', new ProgressPayload('end', false, 'CrowdSec uninstallation finished'));

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        ...result,
        ...(centralBouncerCleanupRequired ? { central_bouncer_cleanup_required: true } : {}),
        ...(centralMachineCleanupRequired ? { central_machine_cleanup_required: true } : {}),
      });
  }

  private async getAgentCommunication(): Promise<AgentCommunication> {
    if (this._firewall.install_communication !== FirewallInstallCommunication.Agent) {
      throw new HttpException('CrowdSec requires FWCloud Agent communication', 409);
    }

    const communication = await this._firewall.getCommunication();
    if (!(communication instanceof AgentCommunication)) {
      throw new HttpException('CrowdSec requires FWCloud Agent communication', 409);
    }

    return communication;
  }

  private async getCrowdSecInstallContext(): Promise<{
    communication: AgentCommunication;
    backend: CrowdSecFirewallBackend | undefined;
  }> {
    const communication = await this.getAgentCommunication();
    const backend = await Firewall.getCrowdSecFirewallBouncerBackend(
      this._firewall.fwCloudId,
      this._firewall.id,
    );

    return { communication, backend: backend ?? undefined };
  }

  private async getCentralFirewall(id: number): Promise<Firewall> {
    if (id === this._firewall.id) {
      throw new HttpException('CrowdSec machine must use a different central LAPI firewall', 422);
    }

    const firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOne({
        where: { id, fwCloudId: this._firewall.fwCloudId },
      });
    if (!firewall) {
      throw new HttpException('Central CrowdSec firewall was not found', 404);
    }

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      firewall.id,
    );
    if (installation?.mode !== CrowdSecInstallationMode.Standalone) {
      throw new HttpException(
        'Central CrowdSec firewall requires a standalone CrowdSec installation',
        409,
      );
    }

    return firewall;
  }

  private async assertCanTransitionStandaloneToMachine(): Promise<void> {
    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (
      installation?.mode === CrowdSecInstallationMode.Standalone &&
      (await this.getCrowdSecInstallationRepository().hasMachineDependents(this._firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec standalone Local API has dependent machines and cannot be converted to a Machine',
        409,
      );
    }
  }

  private async getCentralAgentCommunication(firewall: Firewall): Promise<AgentCommunication> {
    if (
      firewall.install_communication !== FirewallInstallCommunication.Agent ||
      firewall.install_protocol !== FirewallInstallProtocol.HTTPS
    ) {
      throw new HttpException(
        'Central CrowdSec LAPI requires HTTPS FWCloud Agent communication',
        409,
      );
    }

    const communication = await firewall.getCommunication();
    if (!(communication instanceof AgentCommunication)) {
      throw new HttpException(
        'Central CrowdSec LAPI requires HTTPS FWCloud Agent communication',
        409,
      );
    }

    return communication;
  }

  private isCentralLapiListener(listenUri: string): boolean {
    return !listenUri.startsWith('127.0.0.1:') && !listenUri.startsWith('[::1]:');
  }

  private getFirewallRepository(): FirewallRepository {
    return new FirewallRepository(db.getSource().manager);
  }

  private getCrowdSecInstallationRepository(): CrowdSecInstallationRepository {
    return new CrowdSecInstallationRepository(db.getSource().manager);
  }

  private decisionId(req: Request): string {
    const id = String(req.params.decision);
    if (!/^[1-9]\d{0,18}$/.test(id)) {
      throw new HttpException('Invalid CrowdSec decision ID', 400);
    }

    return id;
  }

  private bouncerName(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value)) {
      throw new HttpException('Invalid CrowdSec bouncer name', 400);
    }
    if (value === 'fwcloud') {
      throw new HttpException('The FWCloud bouncer name is reserved', 409);
    }

    return value;
  }

  private machineName(value: unknown): string {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value)) {
      throw new HttpException('Invalid CrowdSec machine name', 400);
    }

    return value;
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

  private optionalBouncerApiKey(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const apiKey = value.trim();

    return apiKey.length > 0 ? apiKey : undefined;
  }
}
