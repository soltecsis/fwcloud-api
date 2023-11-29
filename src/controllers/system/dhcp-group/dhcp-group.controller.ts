/*!
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { getRepository } from "typeorm";
import { Controller } from "../../../fonaments/http/controller";
import { Firewall } from "../../../models/firewall/Firewall";
import { FwCloud } from "../../../models/fwcloud/FwCloud";
import { DHCPGroup } from "../../../models/system/dhcp/dhcp_g/dhcp_g.model";
import { DHCPGroupService } from "../../../models/system/dhcp/dhcp_g/dhcp_g.service";
import { Request } from 'express';
import { DHCPGroupPolicy } from "../../../policies/dhcp-group.policy";
import { Validate } from "../../../decorators/validate.decorator";
import { ResponseBuilder } from "../../../fonaments/http/response-builder";
import { DHCPGroupControllerCreateDto } from "./dto/create.dto";

export class DhcpGroupController extends Controller {
  protected _dhcpGroupService: DHCPGroupService;

  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  protected _dhcpGroup: DHCPGroup;

  public async make(request: Request): Promise<void> {
    this._dhcpGroupService = await this._app.getService<DHCPGroupService>(DHCPGroupService.name);

    if (request.params.dhcpGroup) {
      this._dhcpGroup = await getRepository(DHCPGroup).findOneOrFail(parseInt(request.params.dhcpGroup));
    }

    //Get the firewall from the URL which contains the dhcp group 
    const firewallQueryBuilder = getRepository(Firewall).createQueryBuilder('firewall').where('firewall.id = :id', { id: parseInt(request.params.firewall) });
    if (request.params.dhcpGroup) {
      firewallQueryBuilder.innerJoin('firewall.dhcpGroups', 'group', 'group.id = :groupId', { groupId: parseInt(request.params.dhcpGroup) })
    }
    this._firewall = await firewallQueryBuilder.getOneOrFail();

    //Get the fwcloud from the URL which contains the firewall
    this._fwCloud = await getRepository(FwCloud).createQueryBuilder('fwcloud')
      .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', { firewallId: this._firewall.id })
      .where('fwcloud.id = :id', { id: parseInt(request.params.fwcloud) }).getOneOrFail();
  }

  @Validate()
  async index(req: Request): Promise<ResponseBuilder> {
    (await DHCPGroupPolicy.index(this._firewall, req.session.user)).authorize();

    const groups: DHCPGroup[] = await this._dhcpGroupService.findManyInPath({
      firewallId: this._firewall.id,
      fwcloudId: this._fwCloud.id,
    }) as unknown as DHCPGroup[];

    return ResponseBuilder.buildResponse().status(200).body(groups);
  }

  @Validate(DHCPGroupControllerCreateDto)
  async create(req: Request): Promise<ResponseBuilder> {
    (await DHCPGroupPolicy.create(this._firewall, req.session.user)).authorize();

    const group: DHCPGroup = await this._dhcpGroupService.create({
      firewallId: this._firewall.id,
      name: req.body.name,
      style: req.body.style,
      rules: req.inputs.get<number[]>('rules').map((id) => ({ id })),
    });

    return ResponseBuilder.buildResponse().status(201).body(group);
  }

  @Validate()
  async show(req: Request): Promise<ResponseBuilder> {
    (await DHCPGroupPolicy.show(this._dhcpGroup, req.session.user)).authorize();

    return ResponseBuilder.buildResponse().status(200).body(this._dhcpGroup);
  }

  @Validate(DHCPGroupControllerCreateDto)
  async update(req: Request): Promise<ResponseBuilder> {
    (await DHCPGroupPolicy.update(this._dhcpGroup, req.session.user)).authorize();

    const result = await this._dhcpGroupService.update(this._dhcpGroup.id, req.inputs.all());

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  async remove(req: Request): Promise<ResponseBuilder> {
    (await DHCPGroupPolicy.remove(this._dhcpGroup, req.session.user)).authorize();

    await this._dhcpGroupService.remove({
      id: parseInt(req.params.dhcpGroup),
      firewallId: this._firewall.id,
      fwcloudId: this._fwCloud.id,
    });
    return ResponseBuilder.buildResponse().status(200).body(this._dhcpGroup);
  }
}