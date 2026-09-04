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
    return ResponseBuilder.buildResponse().status(200).body(status);
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

    const result = await (
      await this.getAgentCommunication()
    ).configureCrowdSecCentralLapi(req.body.listenUri);
    return ResponseBuilder.buildResponse().status(200).body(result);
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
    await this.getCrowdSecInstallationRepository().removeMachineInstallation(
      this._firewall.id,
      machineName,
    );

    return ResponseBuilder.buildResponse().status(200).body(machine);
  }

  @Validate(CrowdSecMachineInstallDto)
  public async installMachine(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const centralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
    const centralCommunication = await this.getCentralAgentCommunication(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const lapiUrl = this.lapiUrl(req.body.lapiUrl);
    const channel = await Channel.fromRequest(req);

    channel.emit('message', new ProgressPayload('start', false, 'Installing CrowdSec machine'));

    await centralCommunication.configureCrowdSecCentralLapi(this.listenerUriForLapiUrl(lapiUrl));
    const centralAgentTlsFingerprint = await centralCommunication.getTlsCertificateFingerprint();
    const preflight = await centralCommunication.createCrowdSecLapiPreflightToken(
      req.body.machineName,
    );
    const preflightToken = this.preflightToken(preflight);
    const machine = await remoteCommunication.installCrowdSecMachine(
      {
        machineName: req.body.machineName,
        lapiUrl,
        centralAgentUrl: centralCommunication.getUrl(),
        centralAgentTlsFingerprint,
        preflightToken,
      },
      channel,
    );
    let bouncerName: string | undefined;

    try {
      const validation = await centralCommunication.validateCrowdSecLapiMachine(
        req.body.machineName,
      );
      const bouncerApiKey = req.body.localRemediation
        ? this.bouncerApiKey(
            await centralCommunication.registerCrowdSecBouncer(
              (bouncerName = this.machineName(req.body.machineName)),
            ),
          )
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
      if (bouncerName !== undefined) {
        try {
          await centralCommunication.removeCrowdSecBouncer(bouncerName);
        } catch {
          // The primary installation error is more useful than a failed Bouncer cleanup.
        }
      }

      try {
        await centralCommunication.removeCrowdSecLapiMachine(req.body.machineName);
      } catch {
        // The primary installation error is more useful than a failed Machine cleanup.
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
    if (
      installation?.mode === CrowdSecInstallationMode.Standalone &&
      (await this.getCrowdSecInstallationRepository().hasMachineDependents(this._firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec standalone Local API has dependent machines and cannot be uninstalled',
        409,
      );
    }

    if (
      installation?.mode === CrowdSecInstallationMode.Machine &&
      installation.localRemediation &&
      installation.centralFirewallId !== null &&
      installation.machineName !== null
    ) {
      const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
      await (
        await this.getCentralAgentCommunication(centralFirewall)
      ).removeCrowdSecBouncer(installation.machineName);
    }

    const channel = await Channel.fromRequest(req);
    channel.emit('message', new ProgressPayload('start', false, 'Uninstalling CrowdSec'));

    const result = await (
      await this.getAgentCommunication()
    ).uninstallCrowdSec(req.body.confirm, channel);
    this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
      this._firewall,
      false,
    );
    await this.getCrowdSecInstallationRepository().removeByFirewallId(this._firewall.id);

    channel.emit('message', new ProgressPayload('end', false, 'CrowdSec uninstallation finished'));

    return ResponseBuilder.buildResponse().status(200).body(result);
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

  private preflightToken(response: Record<string, unknown>): string {
    if (typeof response.token !== 'string' || response.token.length === 0) {
      throw new HttpException('Unable to create CrowdSec Local API preflight token', 502);
    }

    return response.token;
  }

  private bouncerApiKey(response: Record<string, unknown>): string {
    if (typeof response.api_key !== 'string' || response.api_key.length === 0) {
      throw new HttpException('Unable to create CrowdSec Firewall Bouncer API key', 502);
    }

    return response.api_key;
  }
}
