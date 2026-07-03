import { Request } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { OpenVPN } from '../../../models/vpn/openvpn/OpenVPN';
import { OpenVPNOption } from '../../../models/vpn/openvpn/openvpn-option.model';
import {
  OpenVPNStatusSamplingAgentStatus,
  OpenVPNStatusSamplingImportSummary,
  OpenVPNStatusSamplingService,
} from '../../../models/vpn/openvpn/status/openvpn-status-sampling.service';
import { FirewallPolicy } from '../../../policies/firewall.policy';
import db from '../../../database/database-manager';
import { OpenVPNStatusSamplingUpdateDto } from './dtos/status-sampling.dto';

type OpenVPNStatusSamplingResponse = {
  enabled: boolean;
  firewall: number;
  openvpn: number;
  collector_firewall: number | null;
  status_file: string | null;
  last_sync_result: string | null;
  last_sync_error: string | null;
  last_synced_at: Date | null;
  last_poll_result: string | null;
  last_poll_error: string | null;
  last_polled_at: Date | null;
  agent_state: {
    enabled: boolean;
    status_files: string[];
    error: string | null;
  } | null;
};

type OpenVPNStatusSamplingImportResponse = {
  import_result: OpenVPNStatusSamplingImportSummary;
};

export class OpenVPNStatusSamplingController extends Controller {
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  protected _openVPN: OpenVPN;
  protected _samplingService: OpenVPNStatusSamplingService;

  public async make(request: Request): Promise<void> {
    this._samplingService = await this._app.getService<OpenVPNStatusSamplingService>(
      OpenVPNStatusSamplingService.name,
    );

    this._firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({
        where: {
          id: parseInt(String(request.params.firewall)),
          fwCloudId: parseInt(String(request.params.fwcloud)),
        },
      });

    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .findOneOrFail({ where: { id: parseInt(String(request.params.fwcloud)) } });

    if (request.params.openvpn) {
      this._openVPN = await db
        .getSource()
        .manager.getRepository(OpenVPN)
        .findOneOrFail({
          where: {
            id: parseInt(String(request.params.openvpn)),
            firewallId: this._firewall.id,
          },
        });
    }
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await FirewallPolicy.compile(this._firewall, request.session.user)).authorize();

    const openVPN: OpenVPN | null = await this._samplingService.findOneByOpenVPN(this._openVPN.id);
    const agentStatus: OpenVPNStatusSamplingAgentStatus | null =
      await this._samplingService.getAgentStatus(openVPN);

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(openVPN, agentStatus));
  }

  @Validate(OpenVPNStatusSamplingUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    (await FirewallPolicy.compile(this._firewall, request.session.user)).authorize();
    const input = request.inputs.all() as unknown as OpenVPNStatusSamplingUpdateDto;

    let openVPN: OpenVPN = await this._samplingService.save({
      openVPNId: this._openVPN.id,
      enabled: input.enabled,
      collectorFirewallId: this._firewall.id,
      statusFile: input.status_file ?? null,
    });
    openVPN = await this._samplingService.syncAgent(openVPN);
    const agentStatus: OpenVPNStatusSamplingAgentStatus | null =
      await this._samplingService.getAgentStatus(openVPN);

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(openVPN, agentStatus));
  }

  @Validate()
  public async importFromAgent(request: Request): Promise<ResponseBuilder> {
    (await FirewallPolicy.compile(this._firewall, request.session.user)).authorize();

    const importResult: OpenVPNStatusSamplingImportSummary =
      await this._samplingService.importFromAgentEnv(this._firewall.id);

    return ResponseBuilder.buildResponse()
      .status(200)
      .body({
        import_result: importResult,
      } as OpenVPNStatusSamplingImportResponse);
  }

  protected toResponse(
    openVPN: OpenVPN | null,
    agentStatus: OpenVPNStatusSamplingAgentStatus | null,
  ): OpenVPNStatusSamplingResponse {
    if (!openVPN) {
      return {
        enabled: false,
        firewall: this._firewall.id,
        openvpn: this._openVPN.id,
        collector_firewall: null,
        status_file: null,
        last_sync_result: null,
        last_sync_error: null,
        last_synced_at: null,
        last_poll_result: null,
        last_poll_error: null,
        last_polled_at: null,
        agent_state: null,
      };
    }

    return {
      enabled: Boolean(openVPN.statusSamplingEnabled),
      firewall: this._firewall.id,
      openvpn: openVPN.id,
      collector_firewall: openVPN.firewallId,
      status_file: this.getStatusFile(openVPN),
      last_sync_result: null,
      last_sync_error: null,
      last_synced_at: null,
      last_poll_result: null,
      last_poll_error: null,
      last_polled_at: null,
      agent_state: agentStatus
        ? {
            enabled: agentStatus.enabled,
            status_files: agentStatus.statusFiles,
            error: agentStatus.error,
          }
        : null,
    };
  }

  protected getStatusFile(openVPN: OpenVPN): string | null {
    return (
      openVPN.openVPNOptions?.find((option: OpenVPNOption) => option.name === 'status')?.arg ?? null
    );
  }
}
