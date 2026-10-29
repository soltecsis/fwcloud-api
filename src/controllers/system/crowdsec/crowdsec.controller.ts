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
import { CrowdSecFirewallBackend } from '../../../communications/communication';
import { Validate, ValidateQuery } from '../../../decorators/validate.decorator';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall, FirewallInstallCommunication } from '../../../models/firewall/Firewall';
import { FirewallRepository } from '../../../models/firewall/firewall.repository';
import { Cluster } from '../../../models/firewall/Cluster';
import { CrowdSecInstallationRepository } from '../../../models/system/crowdsec/crowdsec.repository';
import { CrowdSecPolicy } from '../../../policies/crowdsec.policy';
import { Channel } from '../../../sockets/channels/channel';
import { ProgressPayload } from '../../../sockets/messages/socket-message';
import db from '../../../database/database-manager';
import { CrowdSecCollectionsQueryDto } from './dto/collections-query.dto';
import { CrowdSecAlertsQueryDto } from './dto/alerts-query.dto';
import { CrowdSecBouncerDto } from './dto/bouncer.dto';
import { CrowdSecCollectionDto } from './dto/collection.dto';
import {
  CrowdSecCollectionAcquisitionQueryDto,
  CrowdSecCollectionAcquisitionParserSelectionDto,
  CrowdSecCollectionAcquisitionUpdateDto,
} from './dto/collection-acquisition.dto';
import { CrowdSecConsoleEnrollDto } from './dto/console-enroll.dto';
import { CrowdSecDecisionsFlushDto } from './dto/decisions-flush.dto';
import { CrowdSecDecisionsQueryDto } from './dto/decisions-query.dto';
import { CrowdSecUninstallDto } from './dto/uninstall.dto';
import { CrowdSecMachineInstallDto } from './dto/machine-install.dto';
import { CrowdSecTransitionDto } from './dto/transition.dto';
import { CrowdSecCentralLapiConfigureDto } from './dto/central-lapi-configure.dto';
import { CrowdSecLapiSharedService } from './crowdsec-lapi-shared.service';
import { PgpHelper } from '../../../utils/pgp';
import { CrowdSecInstallationMode } from '../../../models/system/crowdsec/crowdsec-installation.model';
import { CrowdSecBlockingStatisticsSamplingDto } from './dto/blocking-statistics-sampling.dto';
import {
  CrowdSecBlockingStatisticsAddressHistoryQueryDto,
  CrowdSecBlockingStatisticsAddressOptionsQueryDto,
  CrowdSecBlockingStatisticsHistoryQueryDto,
} from './dto/blocking-statistics-history-query.dto';
import { CrowdSecBlockingStatisticsSharedService } from './crowdsec-blocking-statistics-shared.service';
import { CrowdSecCollectionAcquisitionService } from './crowdsec-collection-acquisition.service';
import {
  Body,
  Delete,
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

interface CrowdSecApiEnvelopeResponse<TData> {
  status: number;
  response: string;
  message: string;
  data: TData;
}

interface CrowdSecApiErrorResponse {
  status: number;
  response: string;
  message: string;
  errors?: Record<string, unknown>;
}

interface CrowdSecCentralLapiCandidatesResponse {
  candidates: Array<{ id: number; name: string; cluster_id?: number }>;
}

interface CrowdSecConfirmationResponse {
  console_enrollment_confirmed: boolean;
}

interface CrowdSecConsoleStatusResponse {
  state: 'connected' | 'not_configured' | 'pending_approval' | 'rate_limited' | 'error';
  enrollment_state: 'enrolled' | 'unknown';
  message: string;
}

interface CrowdSecTransitionResponse {
  changed: boolean;
  preparation?: Record<string, unknown>;
  validation?: Record<string, unknown>;
  activation?: Record<string, unknown>;
  finalization?: Record<string, unknown>;
  source_machine_removed?: boolean;
  source_bouncer_cleanup_required?: boolean;
  central_bouncer_cleanup_required?: boolean;
}

interface CrowdSecMachineInstallationResponse {
  machine: Record<string, unknown>;
  validation?: Record<string, unknown>;
  activation?: Record<string, unknown>;
  connectivity_confirmation_required?: boolean;
  connectivity_confirmation_reason?: string;
  pending_connectivity?: boolean;
}

interface CrowdSecUninstallResponse {
  steps: Array<Record<string, unknown>>;
  central_bouncer_cleanup_required?: boolean;
  central_machine_cleanup_required?: boolean;
}

interface CrowdSecBouncerRegistrationResponse {
  name: string;
  /** PGP-encrypted API key. */
  api_key?: string;
  nodes?: Array<Record<string, unknown>>;
}

interface CrowdSecCollectionMutationResponse {
  result: Record<string, unknown>;
  collections: Record<string, unknown>;
}

interface CrowdSecBlockingStatisticsSamplingResponse {
  enabled: boolean;
  sampling_interval: number;
  request_max_samples: number;
  cache_max_size: number;
  completed?: boolean;
  nodes?: Array<Record<string, unknown>>;
}

interface CrowdSecBlockingStatisticsCounter {
  packets: number;
  bytes: number;
}

interface CrowdSecBlockingStatisticsHistoryResponse {
  samples: Array<{
    collected_at: string;
    policy_generation: string;
    ipv4_input: CrowdSecBlockingStatisticsCounter;
    ipv4_forward: CrowdSecBlockingStatisticsCounter;
    ipv6_input: CrowdSecBlockingStatisticsCounter;
    ipv6_forward: CrowdSecBlockingStatisticsCounter;
  }>;
  pagination: Record<string, number>;
}

interface CrowdSecBlockingStatisticsAddressHistoryResponse {
  samples: Array<{
    address: string;
    collected_at: string;
    policy_generation: string;
    packets: number;
    bytes: number;
  }>;
  pagination: Record<string, number>;
}

interface CrowdSecBlockingStatisticsAddressOptionsResponse {
  addresses: string[];
  pagination: Record<string, number>;
}

interface CrowdSecCollectionAcquisitionResponse {
  collection: string;
  file_path: string;
  state: 'ready' | 'automatic_configuration_unavailable' | 'manual_review_required';
  label_type?: string;
  candidate_label_types: string[];
  log_paths: string[];
  message: string;
}

type CrowdSecDynamicResponse = Record<string, unknown>;

@Route('fwclouds/{fwcloud}/firewalls/{firewall}/system/crowdsec')
@Tags('crowdsec')
export class CrowdSecController extends Controller {
  protected _firewall: Firewall;

  public async make(request: ExpressRequest): Promise<void> {
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
  @OperationId('Get firewall CrowdSec status')
  @Get('status')
  @SuccessResponse('200', 'CrowdSec status retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      crowdsec: { installed: true, running: true, version: 'v1.8.1' },
      ipset_installed: true,
      lapi: { state: 'ready', message: 'CrowdSec Local API is reachable' },
      community_blocklist: { state: 'ready', message: 'CrowdSec Central API is reachable' },
      community_blocklist_enrollment: 'enrolled',
      installation_mode: 'lapi',
      local_remediation: false,
      central_lapi_enabled: true,
      central_lapi_has_machines: false,
      machine_connectivity_pending: false,
      console_enrollment_confirmed: true,
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async status(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();
    const status = await (await this.getAgentCommunication()).getCrowdSecStatus();
    const installationRepository = this.getCrowdSecInstallationRepository();
    const installation = await installationRepository.findByFirewallId(this._firewall.id);
    const communityBlocklistEnrollment = status.community_blocklist_enrollment ?? 'unknown';
    let consoleEnrollmentConfirmed = installation?.consoleEnrollmentConfirmed === true;
    if (
      installation?.mode === CrowdSecInstallationMode.Lapi &&
      communityBlocklistEnrollment === 'enrolled' &&
      !consoleEnrollmentConfirmed
    ) {
      await installationRepository.setConsoleEnrollmentConfirmed(this._firewall.id, true);
      consoleEnrollmentConfirmed = true;
    }
    const centralLapiEnabled = installation?.centralLapiEnabled === true;
    const centralLapiHasMachines =
      centralLapiEnabled && (await installationRepository.hasMachineDependents(this._firewall.id));
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
        community_blocklist_enrollment: communityBlocklistEnrollment,
        console_enrollment_confirmed: consoleEnrollmentConfirmed,
        installation_mode: installation?.mode ?? null,
        local_remediation: installation?.localRemediation ?? false,
        central_lapi_firewall_id: installation?.centralFirewallId ?? null,
        central_lapi_url: installation?.lapiUrl ?? null,
        machine_name: installation?.machineName ?? null,
      });
  }

  @Validate()
  @ValidateQuery(CrowdSecCollectionsQueryDto)
  @OperationId('List firewall CrowdSec collections')
  @Get('collections')
  @SuccessResponse('200', 'CrowdSec collections retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { collections: [] },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async collections(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Query('installed') installedQuery?: 'true' | 'false',
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const installed =
      req.query.installed === undefined ? undefined : req.query.installed === 'true';
    const collections = await (
      await this.getAgentCommunication()
    ).getCrowdSecCollections(installed);

    return ResponseBuilder.buildResponse().status(200).body(collections);
  }

  @Validate()
  @ValidateQuery(CrowdSecCollectionAcquisitionQueryDto)
  @OperationId('Get CrowdSec collection acquisition')
  @Get('collections/acquisition')
  @SuccessResponse('200', 'Collection acquisition retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCollectionAcquisitionResponse>>({
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
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async collectionAcquisition(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() firewall: number,
    @Query('name') nameQuery: string,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const name = req.query.name as string;
    await CrowdSecCollectionAcquisitionService.ensureCollectionInstalled(communication, name);
    const acquisition = await communication.getCrowdSecCollectionAcquisition(name);

    return ResponseBuilder.buildResponse().status(200).body(acquisition);
  }

  @Validate(CrowdSecCollectionAcquisitionUpdateDto)
  @OperationId('Update CrowdSec collection acquisition')
  @Put('collections/acquisition')
  @SuccessResponse('200', 'Collection acquisition updated')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCollectionAcquisitionResponse>>({
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
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async updateCollectionAcquisition(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() firewall: number,
    @Body() body: CrowdSecCollectionAcquisitionUpdateDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
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
  @OperationId('Select CrowdSec collection acquisition parser')
  @Put('collections/acquisition/parser')
  @SuccessResponse('200', 'Collection acquisition parser selected')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCollectionAcquisitionResponse>>({
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
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async selectCollectionAcquisitionParser(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() firewall: number,
    @Body() body: CrowdSecCollectionAcquisitionParserSelectionDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
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
  @OperationId('Get firewall CrowdSec Console status')
  @Get('console/status')
  @SuccessResponse('200', 'CrowdSec Console status retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecConsoleStatusResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      state: 'connected',
      enrollment_state: 'unknown',
      message: 'CrowdSec Central API is reachable',
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async consoleStatus(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const status = await (await this.getAgentCommunication()).getCrowdSecConsoleStatus();
    return ResponseBuilder.buildResponse().status(200).body(status);
  }

  @Validate()
  @ValidateQuery(CrowdSecDecisionsQueryDto)
  @OperationId('List firewall CrowdSec decisions')
  @Get('decisions')
  @SuccessResponse('200', 'CrowdSec decisions retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { decisions: [] },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async decisions(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Query('limit') limit?: number,
    @Query('scope') scope?: string,
    @Query('value') value?: string,
    @Query('decision_type') decisionType?: string,
    @Query('origin') origin?: string,
    @Query('scenario') scenario?: string,
  ): Promise<ResponseBuilder> {
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
  @OperationId('List firewall CrowdSec alerts')
  @Get('alerts')
  @SuccessResponse('200', 'CrowdSec alerts retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { alerts: [] },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async alerts(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Query('limit') limit?: number,
    @Query('since') since?: string,
    @Query('until') until?: string,
    @Query('scenario') scenario?: string,
    @Query('type') type?: string,
    @Query('scope') scope?: string,
    @Query('value') value?: string,
    @Query('ip') ip?: string,
    @Query('range') range?: string,
  ): Promise<ResponseBuilder> {
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
  @OperationId('List firewall CrowdSec bouncers')
  @Get('bouncers')
  @SuccessResponse('200', 'CrowdSec bouncers retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { bouncers: [] },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async bouncers(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const bouncers = await (await this.getAgentCommunication()).getCrowdSecBouncers();
    return ResponseBuilder.buildResponse().status(200).body(bouncers);
  }

  @Validate()
  @OperationId('Get CrowdSec blocking statistics sampling configuration')
  @Get('blocking-statistics/sampling')
  @SuccessResponse('200', 'Blocking statistics sampling configuration retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecBlockingStatisticsSamplingResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      enabled: true,
      sampling_interval: 60,
      request_max_samples: 1000,
      cache_max_size: 10000,
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatisticsSampling(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const configuration =
      await CrowdSecBlockingStatisticsSharedService.samplingService().configuration(
        this._firewall.id,
      );
    return ResponseBuilder.buildResponse()
      .status(200)
      .body(CrowdSecBlockingStatisticsSharedService.samplingResponse(configuration));
  }

  @Validate(CrowdSecBlockingStatisticsSamplingDto)
  @OperationId('Update CrowdSec blocking statistics sampling configuration')
  @Put('blocking-statistics/sampling')
  @SuccessResponse('200', 'Blocking statistics sampling configuration updated')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecBlockingStatisticsSamplingResponse>>({
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
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async updateBlockingStatisticsSampling(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() firewall: number,
    @Body() body: CrowdSecBlockingStatisticsSamplingDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const service = CrowdSecBlockingStatisticsSharedService.samplingService();
    const current = await service.configuration(this._firewall.id);
    const result = await service.update([this._firewall], {
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
  @ValidateQuery(CrowdSecBlockingStatisticsHistoryQueryDto)
  @OperationId('List CrowdSec blocking statistics')
  @Get('blocking-statistics')
  @SuccessResponse('200', 'Blocking statistics retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecBlockingStatisticsHistoryResponse>>({
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
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatistics(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Query('starts_at') startsAt?: number,
    @Query('ends_at') endsAt?: number,
    @Query('page') pageQuery?: number,
    @Query('limit') limit?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const history = await (
      await CrowdSecBlockingStatisticsSharedService.statisticsService(this._app)
    ).history(
      this._firewall.id,
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
  @ValidateQuery(CrowdSecBlockingStatisticsAddressHistoryQueryDto)
  @OperationId('List CrowdSec blocking statistics by address')
  @Get('blocking-statistics/addresses')
  @SuccessResponse('200', 'Address blocking statistics retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecBlockingStatisticsAddressHistoryResponse>>({
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
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatisticsAddresses(
    @Request() req: ExpressRequest,
    @Path() fwcloud: number,
    @Path() firewall: number,
    @Query('addresses') addresses: string,
    @Query('starts_at') startsAt?: number,
    @Query('ends_at') endsAt?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const history = await (
      await CrowdSecBlockingStatisticsSharedService.statisticsService(this._app)
    ).addressHistory(
      this._firewall.id,
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
  @ValidateQuery(CrowdSecBlockingStatisticsAddressOptionsQueryDto)
  @OperationId('List CrowdSec blocking statistics address options')
  @Get('blocking-statistics/addresses/options')
  @SuccessResponse('200', 'Blocking statistics address options retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecBlockingStatisticsAddressOptionsResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { addresses: ['203.0.113.10'], pagination: { page: 1, limit: 1000, total: 1, pages: 1 } },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async blockingStatisticsAddressOptions(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Query('starts_at') startsAt?: number,
    @Query('ends_at') endsAt?: number,
    @Query('page') pageQuery?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.view(this._firewall, req.session.user)).authorize();

    const page = await (
      await CrowdSecBlockingStatisticsSharedService.statisticsService(this._app)
    ).addressOptions(this._firewall.id, {
      ...CrowdSecBlockingStatisticsSharedService.range(req),
      ...CrowdSecBlockingStatisticsSharedService.pagination(req),
      search: req.query.search as string | undefined,
    });
    return ResponseBuilder.buildResponse()
      .status(200)
      .body(CrowdSecBlockingStatisticsSharedService.addressOptionsResponse(page));
  }

  @Validate()
  @OperationId('List firewall CrowdSec machines')
  @Get('machines')
  @SuccessResponse('200', 'CrowdSec machines retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { machines: [] },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async machines(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const machines = await (await this.getAgentCommunication()).getCrowdSecLapiMachines();
    return ResponseBuilder.buildResponse().status(200).body(machines);
  }

  @Validate()
  @OperationId('List central LAPI candidates')
  @Get('lapi/central/candidates')
  @SuccessResponse('200', 'Central LAPI candidates retrieved')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCentralLapiCandidatesResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { candidates: [{ id: 12, name: 'central-lapi' }] },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async centralLapiCandidates(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const excludedFirewallIds = [this._firewall.id];
    if (this._firewall.clusterId !== null && this._firewall.clusterId !== undefined) {
      const cluster = await db
        .getSource()
        .manager.getRepository(Cluster)
        .findOne({
          where: { id: this._firewall.clusterId, fwCloudId: this._firewall.fwCloudId },
          relations: ['firewalls'],
        });
      if (cluster) {
        excludedFirewallIds.splice(
          0,
          excludedFirewallIds.length,
          ...cluster.firewalls.map((node) => node.id),
        );
      }
    }

    const candidates = await this.getCrowdSecInstallationRepository().findCentralCandidates(
      this._firewall.fwCloudId,
      excludedFirewallIds,
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        candidates: candidates.map(({ firewall }) => ({
          id: firewall.id,
          name: firewall.name,
          ...(firewall.clusterId !== null && firewall.clusterId !== undefined
            ? { cluster_id: firewall.clusterId }
            : {}),
        })),
      });
  }

  @Validate(CrowdSecCentralLapiConfigureDto)
  @OperationId('Configure central CrowdSec LAPI')
  @Post('lapi/central/configure')
  @SuccessResponse('200', 'Central LAPI configured')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { listen_uri: '0.0.0.0:8080', central_lapi_enabled: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async configureCentralLapi(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecCentralLapiConfigureDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
      throw new HttpException('CrowdSec Local API requires a LAPI CrowdSec installation', 409);
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

    const lapiService = this.lapiService();
    const centralLapiNodes = await lapiService.getCentralNodes(this._firewall);
    const configuredNodes = await lapiService.configureListeners(
      centralLapiNodes,
      req.body.listenUri,
    );
    await lapiService.setCentralLapiEnabled(centralLapiNodes, centralLapiEnabled);
    const localResult = configuredNodes.find((node) => node.firewall_id === this._firewall.id);
    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        ...(localResult?.result ?? { listen_uri: req.body.listenUri }),
        central_lapi_enabled: centralLapiEnabled,
        ...(configuredNodes.length > 1 ? { nodes: configuredNodes } : {}),
      });
  }

  @Validate()
  @OperationId('Validate CrowdSec machine')
  @Post('machines/{machine}/validate')
  @SuccessResponse('200', 'Machine validated')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { name: 'edge-machine', validated: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async validateMachine(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Path('machine') machinePath?: string,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const machineName = CrowdSecLapiSharedService.machineName(req.params.machine);
    const localLapiNodes = await this.getLocalLapiNodes();
    if (localLapiNodes) {
      const validations: Array<Record<string, unknown>> = [];
      let machine: Record<string, unknown> | undefined;
      let completed = true;
      for (const node of localLapiNodes) {
        try {
          const validation = await node.communication.validateCrowdSecLapiMachine(machineName);
          validations.push({ firewall_id: node.firewall.id, validated: true, validation });
          if (node.firewall.id === this._firewall.id) {
            machine = validation;
          }
        } catch {
          completed = false;
          validations.push({
            firewall_id: node.firewall.id,
            validated: false,
            error: 'CrowdSec Machine validation failed',
          });
        }
      }
      return ResponseBuilder.buildResponse()
        .status(200)
        .body({
          ...(machine ?? { name: machineName }),
          completed,
          nodes: validations,
        });
    }

    const machine = await (
      await this.getAgentCommunication()
    ).validateCrowdSecLapiMachine(machineName);
    return ResponseBuilder.buildResponse().status(200).body(machine);
  }

  @Validate()
  @OperationId('Remove CrowdSec machine')
  @Delete('machines/{machine}')
  @SuccessResponse('200', 'Machine removed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { name: 'edge-machine', removed: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async removeMachine(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Path('machine') machinePath?: string,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const machineName = CrowdSecLapiSharedService.machineName(req.params.machine);
    const localLapiNodes = await this.getLocalLapiNodes();
    if (localLapiNodes) {
      for (const node of localLapiNodes) {
        await this.assertMachineRemovalAllowed(node.communication, machineName);
      }
      const cleanup = await this.lapiService().cleanupMachine(localLapiNodes, machineName);
      return ResponseBuilder.buildResponse().status(200).body({
        name: machineName,
        removed: cleanup.completed,
        nodes: cleanup.nodes,
      });
    }

    const communication = await this.getAgentCommunication();
    await this.assertMachineRemovalAllowed(communication, machineName);
    const machine = await communication.removeCrowdSecLapiMachine(machineName);
    return ResponseBuilder.buildResponse().status(200).body(machine);
  }

  @Validate()
  @OperationId('Reauthenticate CrowdSec machine')
  @Post('machines/reauthenticate')
  @SuccessResponse('200', 'Machine reauthenticated')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { reauthenticated: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async reauthenticateMachine(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
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

    const lapiService = this.lapiService();
    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralLapiNodes = await lapiService.getCentralNodes(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    await lapiService.preflight(
      centralLapiNodes,
      CrowdSecLapiSharedService.listenerUriForLapiUrl(installation.lapiUrl),
    );
    await lapiService.enable(centralLapiNodes);
    let reauthenticated = false;
    let machineReplicationCompleted = false;
    let bouncerReplicationStarted = false;
    let bouncerReplicationCompleted = false;
    try {
      const machine = await remoteCommunication.reauthenticateCrowdSecMachine({
        machineName: installation.machineName,
        lapiUrl: installation.lapiUrl,
      });
      reauthenticated = true;
      const validation = {
        nodes: await lapiService.replicateMachineCredentials(
          centralLapiNodes,
          remoteCommunication,
          installation.machineName,
        ),
      };
      machineReplicationCompleted = true;
      const bouncerApiKey =
        installation.machineConnectivityPending && installation.localRemediation
          ? CrowdSecLapiSharedService.generateBouncerApiKey()
          : undefined;
      if (bouncerApiKey) {
        bouncerReplicationStarted = true;
        await lapiService.replicateBouncer(
          centralLapiNodes,
          installation.machineName,
          bouncerApiKey,
        );
        bouncerReplicationCompleted = true;
      }
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
            ...(bouncerApiKey ? { bouncerApiKey } : {}),
          })
        : await remoteCommunication.resumeCrowdSecMachine(
            installation.machineName,
            installation.localRemediation,
          );
      this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
        this._firewall,
        installation.localRemediation,
      );
      await this.getCrowdSecInstallationRepository().setMachineConnectivityPending(
        this._firewall.id,
        false,
      );

      return ResponseBuilder.buildResponse().status(200).body({ machine, validation, activation });
    } catch (error) {
      if (!reauthenticated) {
        throw error;
      }
      const machineCleanup = await lapiService.cleanupMachine(
        machineReplicationCompleted
          ? centralLapiNodes
          : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
        installation.machineName,
      );
      const bouncerCleanup = bouncerReplicationStarted
        ? await lapiService.cleanupBouncer(
            bouncerReplicationCompleted
              ? centralLapiNodes
              : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
            installation.machineName,
          )
        : undefined;
      if (
        !machineCleanup.completed ||
        (bouncerCleanup !== undefined && !bouncerCleanup.completed)
      ) {
        throw new HttpException(
          'CrowdSec Machine reauthentication failed and central Local API cleanup is incomplete',
          502,
        );
      }
      throw error;
    }
  }

  @Validate(CrowdSecMachineInstallDto)
  @OperationId('Install CrowdSec machine')
  @Post('machines/install')
  @SuccessResponse('200', 'Machine installation completed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecMachineInstallationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      machine: { installation_state: 'installed' },
      validation: { nodes: [{ firewall_id: 12, status: 'validated' }] },
      activation: { active: true },
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async installMachine(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecMachineInstallDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    await this.assertCanTransitionLapiToMachine();

    const lapiService = this.lapiService();
    const centralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
    const centralLapiNodes = await lapiService.getCentralNodes(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    const channel = await Channel.fromRequest(req);
    const centralLapiProgress = (message: string) =>
      channel.emit('message', new ProgressPayload('info', false, message));

    channel.emit('message', new ProgressPayload('start', false, 'Installing CrowdSec machine'));

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

    if (
      CrowdSecLapiSharedService.machineInstallationState(machine) ===
      'connectivity_confirmation_required'
    ) {
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
      await lapiService.enable(centralLapiNodes);
    }
    if (CrowdSecLapiSharedService.machineInstallationState(machine) === 'pending_connectivity') {
      this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
        this._firewall,
        req.body.localRemediation,
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

    let machineReplicationCompleted = false;
    let bouncerReplicationStarted = false;
    let bouncerReplicationCompleted = false;
    try {
      const validation = {
        nodes: await lapiService.replicateMachineCredentials(
          centralLapiNodes,
          remoteCommunication,
          req.body.machineName,
          centralLapiProgress,
        ),
      };
      machineReplicationCompleted = true;
      const bouncerApiKey = req.body.localRemediation
        ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
        : undefined;
      if (bouncerApiKey) {
        bouncerReplicationStarted = true;
        await lapiService.replicateBouncer(
          centralLapiNodes,
          CrowdSecLapiSharedService.machineName(req.body.machineName),
          bouncerApiKey,
          centralLapiProgress,
        );
        bouncerReplicationCompleted = true;
      }
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
        req.body.localRemediation,
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
      const machineCleanup = await lapiService.cleanupMachine(
        machineReplicationCompleted
          ? centralLapiNodes
          : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
        req.body.machineName,
      );
      const bouncerCleanup = bouncerReplicationStarted
        ? await lapiService.cleanupBouncer(
            bouncerReplicationCompleted
              ? centralLapiNodes
              : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
            CrowdSecLapiSharedService.machineName(req.body.machineName),
          )
        : undefined;
      if (
        !machineCleanup.completed ||
        (bouncerCleanup !== undefined && !bouncerCleanup.completed)
      ) {
        channel.emit(
          'message',
          new ProgressPayload(
            'warning',
            false,
            'CrowdSec central Local API cleanup is incomplete and must be retried manually',
          ),
        );
      }

      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  @OperationId('Change CrowdSec machine LAPI address')
  @Post('transitions/address')
  @SuccessResponse('200', 'Machine address transitioned')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecTransitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      changed: true,
      preparation: { transition_id: '00000000-0000-4000-8000-000000000000' },
      activation: { changed: true },
      finalization: { completed: true },
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionMachineAddress(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecTransitionDto,
  ): Promise<ResponseBuilder> {
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

    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    if (lapiUrl === installation.lapiUrl) {
      return ResponseBuilder.buildResponse().status(200).body({
        changed: false,
        message: 'CrowdSec Local API address is unchanged',
      });
    }

    const lapiService = this.lapiService();
    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralLapiNodes = await lapiService.getCentralNodes(centralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const channel = await Channel.fromRequest(req);
    const previousListenerUri = CrowdSecLapiSharedService.listenerUriForLapiUrl(
      installation.lapiUrl,
    );
    const targetListenerUri = CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl);
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
        listenerChanged = true;
        await lapiService.preflight(centralLapiNodes, targetListenerUri);
        await lapiService.enable(centralLapiNodes);
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
          await lapiService.configureListeners(centralLapiNodes, previousListenerUri);
        } catch {
          // The original failure is more useful than a failed listener rollback.
        }
      }
      throw error;
    }
  }
  @Validate(CrowdSecTransitionDto)
  @OperationId('Move CrowdSec machine to central LAPI')
  @Post('transitions/central')
  @SuccessResponse('200', 'Machine central LAPI transitioned')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecTransitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      changed: true,
      preparation: { transition_id: '00000000-0000-4000-8000-000000000000' },
      validation: { nodes: [{ firewall_id: 12, status: 'validated' }] },
      activation: { changed: true },
      finalization: { completed: true },
      source_machine_removed: true,
      source_bouncer_cleanup_required: false,
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionMachineCentralLapi(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecTransitionDto,
  ): Promise<ResponseBuilder> {
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

    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
    const lapiService = this.lapiService();
    const targetCentralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
    const targetCentralLapiNodes = await lapiService.getCentralNodes(targetCentralFirewall);
    const remoteCommunication = await this.getAgentCommunication();
    const channel = await Channel.fromRequest(req);
    const backend = installation.localRemediation
      ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
          this._firewall.fwCloudId,
          this._firewall.id,
        )) ?? 'iptables')
      : undefined;
    const transitionId = uuid.v4();

    await lapiService.preflight(
      targetCentralLapiNodes,
      CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl),
    );
    await lapiService.enable(targetCentralLapiNodes);

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
    let machineReplicationCompleted = false;
    let bouncerReplicationStarted = false;
    let bouncerReplicationCompleted = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Moving CrowdSec Machine to a new Local API'),
      );
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      prepared = true;
      const validation = {
        nodes: await lapiService.replicateMachineCredentials(
          targetCentralLapiNodes,
          remoteCommunication,
          installation.machineName,
        ),
      };
      machineReplicationCompleted = true;
      const bouncerApiKey = installation.localRemediation
        ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
        : undefined;
      if (bouncerApiKey) {
        bouncerReplicationStarted = true;
        await lapiService.replicateBouncer(
          targetCentralLapiNodes,
          installation.machineName,
          bouncerApiKey,
        );
        bouncerReplicationCompleted = true;
      }
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
      let sourceMachineRemoved = false;
      try {
        const sourceCentralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
        const sourceCentralLapiNodes = await lapiService.getCentralNodes(sourceCentralFirewall);
        sourceMachineRemoved = (
          await lapiService.cleanupMachine(sourceCentralLapiNodes, installation.machineName)
        ).completed;
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
        const machineCleanup = await lapiService.cleanupMachine(
          machineReplicationCompleted
            ? targetCentralLapiNodes
            : CrowdSecLapiSharedService.replicatedNodes(targetCentralLapiNodes, error),
          installation.machineName,
        );
        const bouncerCleanup = bouncerReplicationStarted
          ? await lapiService.cleanupBouncer(
              bouncerReplicationCompleted
                ? targetCentralLapiNodes
                : CrowdSecLapiSharedService.replicatedNodes(targetCentralLapiNodes, error),
              installation.machineName,
            )
          : undefined;
        if (
          !machineCleanup.completed ||
          (bouncerCleanup !== undefined && !bouncerCleanup.completed)
        ) {
          channel.emit(
            'message',
            new ProgressPayload(
              'warning',
              false,
              'CrowdSec target Local API cleanup is incomplete and must be retried manually',
            ),
          );
        }
      }

      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  @OperationId('Change CrowdSec machine remediation')
  @Post('transitions/remediation')
  @SuccessResponse('200', 'Machine remediation transitioned')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecTransitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      changed: true,
      preparation: { transition_id: '00000000-0000-4000-8000-000000000000' },
      activation: { changed: true },
      finalization: { completed: true },
      central_bouncer_cleanup_required: false,
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionMachineRemediation(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecTransitionDto,
  ): Promise<ResponseBuilder> {
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
    const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
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

    const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
    const lapiService = this.lapiService();
    const centralFirewall = await this.getCentralFirewall(installation.centralFirewallId);
    const centralLapiNodes = await lapiService.getCentralNodes(centralFirewall);
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
    if (req.body.localRemediation) {
      await lapiService.preflight(
        centralLapiNodes,
        CrowdSecLapiSharedService.listenerUriForLapiUrl(installation.lapiUrl),
      );
      await lapiService.enable(centralLapiNodes);
    }
    let prepared = false;
    let activated = false;
    let bouncerReplicationStarted = false;
    let bouncerReplicationCompleted = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Changing CrowdSec local remediation'),
      );
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      prepared = true;
      const bouncerApiKey = req.body.localRemediation
        ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
        : undefined;
      if (bouncerApiKey) {
        bouncerReplicationStarted = true;
        await lapiService.replicateBouncer(
          centralLapiNodes,
          installation.machineName,
          bouncerApiKey,
        );
        bouncerReplicationCompleted = true;
      }
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
      this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
        this._firewall,
        req.body.localRemediation,
      );
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
        if (bouncerReplicationStarted) {
          const cleanup = await lapiService.cleanupBouncer(
            bouncerReplicationCompleted
              ? centralLapiNodes
              : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
            installation.machineName,
          );
          if (!cleanup.completed) {
            channel.emit(
              'message',
              new ProgressPayload(
                'warning',
                false,
                'CrowdSec central Local API Bouncer cleanup is incomplete and must be retried manually',
              ),
            );
          }
        }
      }

      throw error;
    }
  }

  @Validate(CrowdSecTransitionDto)
  @OperationId('Change CrowdSec installation role')
  @Post('transitions/role')
  @SuccessResponse('200', 'CrowdSec role transitioned')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecTransitionResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      changed: true,
      preparation: { transition_id: '00000000-0000-4000-8000-000000000000' },
      activation: { changed: true },
      finalization: { completed: true },
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async transitionCrowdSecRole(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecTransitionDto,
  ): Promise<ResponseBuilder> {
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

    if (installation.mode === CrowdSecInstallationMode.Lapi) {
      if (req.body.mode !== CrowdSecInstallationMode.Machine) {
        throw new HttpException('Invalid CrowdSec role transition target', 422);
      }
      await this.assertCanTransitionLapiToMachine();

      const providedBouncerApiKey = await this.optionalBouncerApiKey(req, req.body.bouncerApiKey);
      const lapiService = this.lapiService();
      const centralFirewall = await this.getCentralFirewall(req.body.centralFirewallId);
      const centralLapiNodes = await lapiService.getCentralNodes(centralFirewall);
      const lapiUrl = CrowdSecLapiSharedService.lapiUrl(req.body.lapiUrl);
      const backend = req.body.localRemediation
        ? ((await Firewall.getCrowdSecFirewallBouncerBackend(
            this._firewall.fwCloudId,
            this._firewall.id,
          )) ?? 'iptables')
        : undefined;
      await lapiService.preflight(
        centralLapiNodes,
        CrowdSecLapiSharedService.listenerUriForLapiUrl(lapiUrl),
      );
      await lapiService.enable(centralLapiNodes);
      const transition = {
        transitionId,
        confirm: true,
        expected: {
          mode: 'lapi' as const,
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
      let machineReplicationCompleted = false;
      let bouncerReplicationStarted = false;
      let bouncerReplicationCompleted = false;
      try {
        channel.emit(
          'message',
          new ProgressPayload('start', false, 'Converting CrowdSec LAPI installation to Machine'),
        );
        const preparation = await remoteCommunication.prepareCrowdSecTransition(
          transition,
          channel,
        );
        prepared = true;
        const validation = {
          nodes: await lapiService.replicateMachineCredentials(
            centralLapiNodes,
            remoteCommunication,
            req.body.machineName,
          ),
        };
        machineReplicationCompleted = true;
        const bouncerApiKey = req.body.localRemediation
          ? (providedBouncerApiKey ?? CrowdSecLapiSharedService.generateBouncerApiKey())
          : undefined;
        if (bouncerApiKey) {
          bouncerReplicationStarted = true;
          await lapiService.replicateBouncer(centralLapiNodes, req.body.machineName, bouncerApiKey);
          bouncerReplicationCompleted = true;
        }
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
        this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
          this._firewall,
          req.body.localRemediation,
        );
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
            // The agent preserves a recovery state when the former LAPI role cannot be restored.
          }
          const machineCleanup = await lapiService.cleanupMachine(
            machineReplicationCompleted
              ? centralLapiNodes
              : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
            req.body.machineName,
          );
          const bouncerCleanup = bouncerReplicationStarted
            ? await lapiService.cleanupBouncer(
                bouncerReplicationCompleted
                  ? centralLapiNodes
                  : CrowdSecLapiSharedService.replicatedNodes(centralLapiNodes, error),
                req.body.machineName,
              )
            : undefined;
          if (
            !machineCleanup.completed ||
            (bouncerCleanup !== undefined && !bouncerCleanup.completed)
          ) {
            channel.emit(
              'message',
              new ProgressPayload(
                'warning',
                false,
                'CrowdSec central Local API cleanup is incomplete and must be retried manually',
              ),
            );
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
      req.body.mode !== CrowdSecInstallationMode.Lapi ||
      !req.body.localRemediation ||
      req.body.bouncerApiKey !== undefined
    ) {
      throw new HttpException('Invalid CrowdSec role transition target', 422);
    }

    const machineConnectivityPending = installation.machineConnectivityPending === true;
    const lapiService = this.lapiService();
    const sourceCentralLapiNodes = machineConnectivityPending
      ? undefined
      : await lapiService.getCentralNodes(
          await this.getCentralFirewall(installation.centralFirewallId),
        );
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
    let prepared = false;
    let activated = false;
    try {
      channel.emit(
        'message',
        new ProgressPayload('start', false, 'Restoring CrowdSec LAPI installation'),
      );
      const preparation = await remoteCommunication.prepareCrowdSecTransition(transition, channel);
      prepared = true;
      const activation = await remoteCommunication.activateCrowdSecTransition(
        { transitionId },
        channel,
      );
      activated = true;
      await this.getCrowdSecInstallationRepository().saveLapiInstallation(this._firewall.id);
      this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
        this._firewall,
        true,
      );
      const finalization = await remoteCommunication.finalizeCrowdSecTransition(transitionId);
      let sourceMachineRemoved = true;
      if (sourceCentralLapiNodes) {
        const cleanup = await lapiService.cleanupMachine(
          sourceCentralLapiNodes,
          installation.machineName,
        );
        sourceMachineRemoved = cleanup.completed;
      }
      channel.emit(
        'message',
        new ProgressPayload('end', false, 'CrowdSec LAPI transition finished'),
      );

      return ResponseBuilder.buildResponse()
        .status(200)
        .body({
          changed: true,
          preparation,
          activation,
          finalization,
          source_machine_removed: sourceMachineRemoved,
          source_bouncer_cleanup_required:
            !machineConnectivityPending && installation.localRemediation,
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
  @OperationId('Register CrowdSec bouncer')
  @Post('bouncers/register')
  @SuccessResponse('200', 'Bouncer registered')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecBouncerRegistrationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      name: 'firewall-bouncer',
      api_key: '-----BEGIN PGP MESSAGE-----\n…\n-----END PGP MESSAGE-----',
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async registerBouncer(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecBouncerDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const name = this.bouncerName(req.body.name);
    const localLapiNodes = await this.getLocalLapiNodes();
    const bouncer = localLapiNodes
      ? {
          name,
          api_key: CrowdSecLapiSharedService.generateBouncerApiKey(),
        }
      : await (await this.getAgentCommunication()).registerCrowdSecBouncer(name);
    const apiKey = bouncer.api_key;
    let replication: Record<string, unknown>[] | undefined;
    if (localLapiNodes && typeof apiKey === 'string') {
      try {
        replication = await this.lapiService().replicateBouncer(localLapiNodes, name, apiKey);
      } catch (error) {
        const cleanup = await this.lapiService().cleanupBouncer(
          CrowdSecLapiSharedService.replicatedNodes(localLapiNodes, error),
          name,
        );
        if (!cleanup.completed) {
          throw new HttpException(
            'CrowdSec central Local API Bouncer cleanup is incomplete and must be retried manually',
            502,
          );
        }
        throw error;
      }
    }
    const pgp = new PgpHelper({ public: req.session.uiPublicKey, private: '' });
    const protectedBouncer =
      typeof apiKey === 'string'
        ? {
            ...bouncer,
            ...(replication ? { nodes: replication } : {}),
            api_key: await pgp.encrypt(apiKey),
          }
        : bouncer;

    return ResponseBuilder.buildResponse().status(200).body(protectedBouncer);
  }

  @Validate()
  @OperationId('Remove CrowdSec bouncer')
  @Delete('bouncers/{bouncer}')
  @SuccessResponse('200', 'Bouncer removed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { name: 'firewall-bouncer', removed: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async removeBouncer(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Path('bouncer') bouncerPath?: string,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const name = this.bouncerName(req.params.bouncer);
    const localLapiNodes = await this.getLocalLapiNodes();
    if (localLapiNodes) {
      const cleanup = await this.lapiService().cleanupBouncer(localLapiNodes, name);
      return ResponseBuilder.buildResponse().status(200).body({
        name,
        removed: cleanup.completed,
        nodes: cleanup.nodes,
      });
    }

    const bouncer = await (await this.getAgentCommunication()).removeCrowdSecBouncer(name);
    return ResponseBuilder.buildResponse().status(200).body(bouncer);
  }

  @Validate()
  @OperationId('Delete CrowdSec decision')
  @Delete('decisions/{decision}')
  @SuccessResponse('200', 'Decision deleted')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { deleted: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async deleteDecision(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Path('decision') decisionPath?: string,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const decision = await (
      await this.getAgentCommunication()
    ).deleteCrowdSecDecision(this.decisionId(req));
    return ResponseBuilder.buildResponse().status(200).body(decision);
  }

  @Validate(CrowdSecDecisionsFlushDto)
  @OperationId('Flush CrowdSec decisions')
  @Post('decisions/flush')
  @SuccessResponse('200', 'Decisions flushed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { flushed: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async flushDecisions(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecDecisionsFlushDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const decisions = await (
      await this.getAgentCommunication()
    ).flushCrowdSecDecisions(req.body.confirm);
    return ResponseBuilder.buildResponse().status(200).body(decisions);
  }

  @Validate(CrowdSecConsoleEnrollDto)
  @OperationId('Enroll CrowdSec Console')
  @Post('console/enroll')
  @SuccessResponse('200', 'Console enrollment requested')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecConsoleStatusResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      state: 'pending_approval',
      enrollment_state: 'unknown',
      message:
        'Enrollment request submitted. Accept the Security Engine in CrowdSec Console to complete enrollment.',
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async enrollConsole(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecConsoleEnrollDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const enrollmentKey = await this.enrollmentKey(req, req.body.enrollmentKey);
    const response = await (
      await this.getAgentCommunication()
    ).enrollCrowdSecConsole({
      ...req.body,
      enrollmentKey,
      name: this.consoleInstanceName(),
    });
    const installationRepository = this.getCrowdSecInstallationRepository();
    if (await installationRepository.findByFirewallId(this._firewall.id)) {
      await installationRepository.setConsoleEnrollmentConfirmed(this._firewall.id, false);
    }
    return ResponseBuilder.buildResponse().status(200).body(response);
  }

  @Validate()
  @OperationId('Confirm CrowdSec Console enrollment')
  @Post('console/enrollment/confirm')
  @SuccessResponse('200', 'Console enrollment confirmed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecConfirmationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { console_enrollment_confirmed: true },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async confirmConsoleEnrollment(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installationRepository = this.getCrowdSecInstallationRepository();
    const installation = await installationRepository.findByFirewallId(this._firewall.id);
    if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
      throw new HttpException(
        'Manual CrowdSec Console enrollment confirmation requires a LAPI installation',
        409,
      );
    }

    await installationRepository.setConsoleEnrollmentConfirmed(this._firewall.id, true);
    return ResponseBuilder.buildResponse().status(200).body({
      console_enrollment_confirmed: true,
    });
  }

  @Validate()
  @OperationId('Clear CrowdSec Console enrollment confirmation')
  @Post('console/enrollment/clear')
  @SuccessResponse('200', 'Console enrollment confirmation cleared')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecConfirmationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { console_enrollment_confirmed: false },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async clearConsoleEnrollment(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installationRepository = this.getCrowdSecInstallationRepository();
    const installation = await installationRepository.findByFirewallId(this._firewall.id);
    if (
      installation?.mode !== CrowdSecInstallationMode.Lapi ||
      installation.consoleEnrollmentConfirmed !== true
    ) {
      throw new HttpException(
        'Clearing CrowdSec Console enrollment confirmation requires a confirmed LAPI installation',
        409,
      );
    }

    await installationRepository.setConsoleEnrollmentConfirmed(this._firewall.id, false);
    return ResponseBuilder.buildResponse().status(200).body({
      console_enrollment_confirmed: false,
    });
  }

  @Validate(CrowdSecCollectionDto)
  @OperationId('Install CrowdSec collection')
  @Post('collections/install')
  @SuccessResponse('200', 'Collection installed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCollectionMutationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { result: {}, collections: {} },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async installCollection(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecCollectionDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const result = await communication.installCrowdSecCollection(req.body.name);
    const collections = await communication.getCrowdSecCollections();

    return ResponseBuilder.buildResponse().status(200).body({ result, collections });
  }

  @Validate(CrowdSecCollectionDto)
  @OperationId('Remove CrowdSec collection')
  @Post('collections/remove')
  @SuccessResponse('200', 'Collection removed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCollectionMutationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { result: {}, collections: {} },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async removeCollection(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecCollectionDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const result = await communication.removeCrowdSecCollection(req.body.name);
    const collections = await communication.getCrowdSecCollections();

    return ResponseBuilder.buildResponse().status(200).body({ result, collections });
  }

  @Validate()
  @OperationId('Update CrowdSec collections')
  @Post('collections/update')
  @SuccessResponse('200', 'Collections updated')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecCollectionMutationResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { result: {}, collections: {} },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async updateCollections(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const communication = await this.getAgentCommunication();
    const result = await communication.updateCrowdSecCollections();
    const collections = await communication.getCrowdSecCollections();

    return ResponseBuilder.buildResponse().status(200).body({ result, collections });
  }

  @Validate()
  @OperationId('Install CrowdSec')
  @Post('install')
  @SuccessResponse('200', 'CrowdSec installed')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecDynamicResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: { crowdsec: {} },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async install(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: Partial<CrowdSecConsoleEnrollDto>,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const enrollmentKey =
      req.body?.enrollmentKey === undefined
        ? undefined
        : await this.enrollmentKey(req, req.body.enrollmentKey);

    const channel = await Channel.fromRequest(req);
    const { communication, backend } = await this.getCrowdSecInstallContext();
    channel.emit('message', new ProgressPayload('start', false, 'Installing CrowdSec'));

    const crowdsec = await communication.installCrowdSec(channel, backend);
    this._firewall = await this.getFirewallRepository().setCrowdSecCompatibility(
      this._firewall,
      true,
    );
    await this.getCrowdSecInstallationRepository().saveLapiInstallation(this._firewall.id);

    if (enrollmentKey !== undefined) {
      channel.emit('message', new ProgressPayload('info', false, 'Enrolling CrowdSec Console'));
      try {
        await communication.enrollCrowdSecConsole({
          enrollmentKey,
          name: this.consoleInstanceName(),
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
            'CrowdSec installation completed successfully, but Console enrollment failed. You can retry enrollment from the Status panel',
          ),
        );
      }
    }

    channel.emit('message', new ProgressPayload('end', false, 'CrowdSec installation finished'));

    return ResponseBuilder.buildResponse().status(200).body({ crowdsec });
  }

  @Validate(CrowdSecUninstallDto)
  @OperationId('Uninstall CrowdSec')
  @Post('uninstall')
  @SuccessResponse('200', 'CrowdSec uninstalled')
  @Example<CrowdSecApiEnvelopeResponse<CrowdSecUninstallResponse>>({
    status: 200,
    response: 'OK',
    message: '',
    data: {
      steps: [],
      central_machine_cleanup_required: false,
      central_bouncer_cleanup_required: false,
    },
  })
  @Response<CrowdSecApiErrorResponse>('default', 'CrowdSec endpoint error')
  public async uninstall(
    @Request() req: ExpressRequest,
    @Path() fwcloud?: number,
    @Path() firewall?: number,
    @Body() body?: CrowdSecUninstallDto,
  ): Promise<ResponseBuilder> {
    (await CrowdSecPolicy.manage(this._firewall, req.session.user)).authorize();

    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    const centralBouncerCleanupRequired =
      installation?.mode === CrowdSecInstallationMode.Machine &&
      installation.localRemediation &&
      !installation.machineConnectivityPending;
    if (
      installation?.mode === CrowdSecInstallationMode.Lapi &&
      (await this.getCrowdSecInstallationRepository().hasMachineDependents(this._firewall.id))
    ) {
      throw new HttpException(
        'CrowdSec LAPI has dependent machines and cannot be uninstalled',
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
        const lapiService = this.lapiService();
        const centralLapiNodes = await lapiService.getCentralNodes(
          await this.getCentralFirewall(installation.centralFirewallId),
        );
        const cleanup = await lapiService.cleanupMachine(
          centralLapiNodes,
          installation.machineName,
        );
        if (!cleanup.completed) {
          throw new Error('Central CrowdSec Machine cleanup is incomplete');
        }
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

  private async assertMachineRemovalAllowed(
    communication: AgentCommunication,
    machineName: string,
  ): Promise<void> {
    const machine = (await communication.getCrowdSecLapiMachines()).machines.find(
      (item) => item.name === machineName,
    );
    if (machine && CrowdSecLapiSharedService.isLoopbackMachineAddress(machine.ip_address)) {
      throw new HttpException('The local CrowdSec LAPI Machine cannot be removed', 409);
    }
  }

  private async getLocalLapiNodes() {
    const installation = await this.getCrowdSecInstallationRepository().findByFirewallId(
      this._firewall.id,
    );
    if (installation?.mode !== CrowdSecInstallationMode.Lapi) {
      return undefined;
    }

    const nodes = await this.lapiService().getCentralNodes(this._firewall);
    return nodes.length > 1 ? nodes : undefined;
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

    return this.lapiService().getCentralFirewall(id);
  }

  private lapiService(): CrowdSecLapiSharedService {
    return new CrowdSecLapiSharedService(db.getSource().manager, this._firewall.fwCloudId);
  }

  private async assertCanTransitionLapiToMachine(): Promise<void> {
    await this.lapiService().assertCanBecomeMachine(this._firewall);
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

  private decisionId(req: ExpressRequest): string {
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

  private consoleInstanceName(): string {
    const name = this._firewall.name?.trim();
    if (name && !/[^A-Za-z0-9._-]/.test(name)) {
      return name;
    }
    return this._firewall.fwCloudId + '-' + this._firewall.id;
  }

  private async enrollmentKey(req: ExpressRequest, value: unknown): Promise<string> {
    const enrollmentKey = await this.decryptCrowdSecSecret(req, value, 'CrowdSec enrollment key');
    if (
      enrollmentKey.length === 0 ||
      enrollmentKey.length > 512 ||
      this.hasControlCharacters(enrollmentKey)
    ) {
      throw new HttpException('Invalid CrowdSec enrollment key', 422);
    }
    return enrollmentKey;
  }

  private async optionalBouncerApiKey(
    req: ExpressRequest,
    value: unknown,
  ): Promise<string | undefined> {
    if (value === undefined) {
      return undefined;
    }

    const apiKey = await this.decryptCrowdSecSecret(
      req,
      value,
      'CrowdSec Firewall Bouncer API key',
    );
    if (apiKey.length === 0 || apiKey.length > 512 || this.hasControlCharacters(apiKey)) {
      throw new HttpException('Invalid CrowdSec Firewall Bouncer API key', 422);
    }

    return apiKey;
  }

  private async decryptCrowdSecSecret(
    req: ExpressRequest,
    value: unknown,
    name: string,
  ): Promise<string> {
    if (typeof value !== 'string') {
      throw new HttpException('Invalid ' + name, 422);
    }

    try {
      return (await new PgpHelper(req.session.pgp).decrypt(value)).trim();
    } catch {
      throw new HttpException('Invalid ' + name, 422);
    }
  }

  private hasControlCharacters(value: string): boolean {
    return Array.from(value).some((character) => {
      const code = character.charCodeAt(0);
      return code < 32 || code === 127;
    });
  }
}
