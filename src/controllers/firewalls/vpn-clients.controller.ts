import { Request } from 'express';
import db from '../../database/database-manager';
import { Validate } from '../../decorators/validate.decorator';
import { Authorization } from '../../fonaments/authorization/policy';
import { NotFoundException } from '../../fonaments/exceptions/not-found-exception';
import { Controller } from '../../fonaments/http/controller';
import { ResponseBuilder } from '../../fonaments/http/response-builder';
import { User } from '../../models/user/User';
import {
  exportVPNClients,
  vpnClientsToCSV,
  VPNProtocol,
} from '../../models/vpn/vpn-clients-export';

export class VPNClientsController extends Controller {
  @Validate()
  public async download(req: Request): Promise<ResponseBuilder> {
    const protocol = (['openvpn', 'wireguard', 'ipsec'] as VPNProtocol[]).find(
      (name) => req.params[name] !== undefined,
    );
    const fwcloud = Number(req.params.fwcloud);
    const firewall = Number(req.params.firewall);
    const serverId = Number(req.params[protocol]);
    if (![fwcloud, firewall, serverId].every((id) => Number.isSafeInteger(id) && id > 0)) {
      throw new NotFoundException();
    }
    const source = db.getSource();
    const user = await source.manager.getRepository(User).findOneOrFail({
      where: { id: req.session.user.id },
      relations: ['fwClouds'],
    });
    (user.role === 1 || user.fwClouds.some((cloud) => cloud.id === fwcloud)
      ? Authorization.grant()
      : Authorization.revoke()
    ).authorize();

    const result = await exportVPNClients(source, protocol, fwcloud, firewall, serverId);
    return ResponseBuilder.buildResponse()
      .status(200)
      .downloadContent(
        vpnClientsToCSV(result.clients),
        `${result.server.name}-clients(${protocol}).csv`,
        'text/csv; charset=utf-8',
      );
  }
}
