import { Request } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import {
  OpenVPNStatusSampling,
  OpenVPNStatusSamplingFile,
} from '../../../models/vpn/openvpn/status/openvpn-status-sampling';
import { OpenVPNStatusSamplingService } from '../../../models/vpn/openvpn/status/openvpn-status-sampling.service';
import { FirewallPolicy } from '../../../policies/firewall.policy';
import db from '../../../database/database-manager';
import { OpenVPNStatusSamplingUpdateDto } from './dtos/status-sampling.dto';

type OpenVPNStatusSamplingResponse = {
  enabled: boolean;
  firewall: number;
  cluster: number | null;
  collector_firewall: number | null;
  status_files: string[];
  last_sync_result: string | null;
  last_sync_error: string | null;
  last_synced_at: Date | null;
  last_poll_result: string | null;
  last_poll_error: string | null;
  last_polled_at: Date | null;
};

export class OpenVPNStatusSamplingController extends Controller {
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
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
  }

  @Validate()
  public async show(request: Request): Promise<ResponseBuilder> {
    (await FirewallPolicy.compile(this._firewall, request.session.user)).authorize();

    const sampling: OpenVPNStatusSampling | null = await this._samplingService.findOneByFirewall(
      this._firewall.id,
    );

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(this.toResponse(sampling, this._firewall.id));
  }

  @Validate(OpenVPNStatusSamplingUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    (await FirewallPolicy.compile(this._firewall, request.session.user)).authorize();
    const input = request.inputs.all() as unknown as OpenVPNStatusSamplingUpdateDto;

    let sampling: OpenVPNStatusSampling = await this._samplingService.save({
      firewallId: this._firewall.id,
      enabled: input.enabled,
      collectorFirewallId: input.collector_firewall,
      statusFiles: input.status_files ?? [],
    });
    sampling = await this._samplingService.syncAgent(sampling);

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(this.toResponse(sampling, this._firewall.id));
  }

  protected toResponse(
    sampling: OpenVPNStatusSampling | null,
    firewallId: number,
  ): OpenVPNStatusSamplingResponse {
    if (!sampling) {
      return {
        enabled: false,
        firewall: firewallId,
        cluster: null,
        collector_firewall: null,
        status_files: [],
        last_sync_result: null,
        last_sync_error: null,
        last_synced_at: null,
        last_poll_result: null,
        last_poll_error: null,
        last_polled_at: null,
      };
    }

    return {
      enabled: Boolean(sampling.enabled),
      firewall: sampling.firewallId,
      cluster: sampling.clusterId,
      collector_firewall: sampling.collectorFirewallId,
      status_files: (sampling.files ?? []).map((file: OpenVPNStatusSamplingFile) => file.path),
      last_sync_result: sampling.lastSyncResult,
      last_sync_error: sampling.lastSyncError,
      last_synced_at: sampling.lastSyncedAt,
      last_poll_result: sampling.lastPollResult,
      last_poll_error: sampling.lastPollError,
      last_polled_at: sampling.lastPolledAt,
    };
  }
}
