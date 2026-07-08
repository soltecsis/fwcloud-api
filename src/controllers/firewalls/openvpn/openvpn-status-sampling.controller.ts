import { Request } from 'express';
import { Validate } from '../../../decorators/validate.decorator';
import { Controller } from '../../../fonaments/http/controller';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { OpenVPN } from '../../../models/vpn/openvpn/OpenVPN';
import { OpenVPNOption } from '../../../models/vpn/openvpn/openvpn-option.model';
import { OpenVPNStatusSamplingService } from '../../../models/vpn/openvpn/status/openvpn-status-sampling.service';
import { FirewallPolicy } from '../../../policies/firewall.policy';
import db from '../../../database/database-manager';
import { OpenVPNStatusSamplingUpdateDto } from './dtos/status-sampling.dto';

type OpenVPNStatusSamplingResponse = {
  enabled: boolean;
  firewall: number;
  openvpn: number;
  status_file: string | null;
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

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(openVPN));
  }

  @Validate(OpenVPNStatusSamplingUpdateDto)
  public async update(request: Request): Promise<ResponseBuilder> {
    (await FirewallPolicy.compile(this._firewall, request.session.user)).authorize();
    const input = request.inputs.all() as unknown as OpenVPNStatusSamplingUpdateDto;

    let openVPN: OpenVPN = await this._samplingService.save({
      openVPNId: this._openVPN.id,
      enabled: input.enabled,
      statusFile: input.status_file ?? null,
    });
    openVPN = await this._samplingService.syncAgent(openVPN);

    return ResponseBuilder.buildResponse().status(200).body(this.toResponse(openVPN));
  }

  protected toResponse(openVPN: OpenVPN | null): OpenVPNStatusSamplingResponse {
    if (!openVPN) {
      return {
        enabled: false,
        firewall: this._firewall.id,
        openvpn: this._openVPN.id,
        status_file: null,
      };
    }

    return {
      enabled: Boolean(openVPN.statusSamplingEnabled),
      firewall: this._firewall.id,
      openvpn: openVPN.id,
      status_file: this.getStatusFile(openVPN),
    };
  }

  protected getStatusFile(openVPN: OpenVPN): string | null {
    return (
      openVPN.openVPNOptions?.find((option: OpenVPNOption) => option.name === 'status')?.arg ?? null
    );
  }
}
