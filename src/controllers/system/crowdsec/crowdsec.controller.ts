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
import { CrowdSecFirewallBackend } from '../../../communications/communication';
import { Validate, ValidateQuery } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall, FirewallInstallCommunication } from '../../../models/firewall/Firewall';
import { FirewallRepository } from '../../../models/firewall/firewall.repository';
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
import { PgpHelper } from '../../../utils/pgp';

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

    const machine = await (
      await this.getAgentCommunication()
    ).removeCrowdSecLapiMachine(this.machineName(req.params.machine));
    return ResponseBuilder.buildResponse().status(200).body(machine);
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

    channel.emit('message', new ProgressPayload('end', false, 'CrowdSec installation finished'));

    return ResponseBuilder.buildResponse().status(200).body({ crowdsec });
  }

  @Validate(CrowdSecUninstallDto)
  public async uninstall(req: Request): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const channel = await Channel.fromRequest(req);
    channel.emit('message', new ProgressPayload('start', false, 'Uninstalling CrowdSec'));

    const result = await (
      await this.getAgentCommunication()
    ).uninstallCrowdSec(req.body.confirm, channel);
    this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
      this._firewall,
      false,
    );

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

  private getFirewallRepository(): FirewallRepository {
    return new FirewallRepository(db.getSource().manager);
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
}
