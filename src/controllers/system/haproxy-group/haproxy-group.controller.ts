/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Controller } from '../../../fonaments/http/controller';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { HAProxyGroup } from '../../../models/system/haproxy/haproxy_g/haproxy_g.model';
import { HAProxyGroupService } from '../../../models/system/haproxy/haproxy_g/haproxy_g.service';
import { HAProxyRuleService } from '../../../models/system/haproxy/haproxy_r/haproxy_r.service';
import { Request } from 'express';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { HAProxyGroupPolicy } from '../../../policies/haproxy-group.policy';
import { Validate } from '../../../decorators/validate.decorator';
import { DHCPGroupControllerCreateDto } from './dto/create.dto';
import { DHCPGroupControllerUpdateDto } from './dto/update.dto';
import db from '../../../database/database-manager';

export class HAProxyGroupController extends Controller {
  protected _haproxyGroupService: HAProxyGroupService;
  protected _haproxyRuleService: HAProxyRuleService;

  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  protected _haproxyGroup: HAProxyGroup;

  public async make(request: Request): Promise<void> {
    this._haproxyGroupService = await this._app.getService<HAProxyGroupService>(
      HAProxyGroupService.name,
    );
    this._haproxyRuleService = await this._app.getService<HAProxyRuleService>(
      HAProxyRuleService.name,
    );

    if (request.params.haproxygroup) {
      this._haproxyGroup = await this._haproxyGroupService.findOneInPath({
        id: parseInt(request.params.haproxygroup),
      });
    }

    this._firewall = await db
      .getSource()
      .manager.getRepository(Firewall)
      .findOneOrFail({ where: { id: parseInt(request.params.firewall) } });
    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .findOneOrFail({ where: { id: parseInt(request.params.fwcloud) } });
  }

  @Validate()
  async index(request: Request): Promise<ResponseBuilder> {
    (await HAProxyGroupPolicy.create(this._firewall, request.session.user)).authorize();

    const groups: HAProxyGroup[] = (await this._haproxyGroupService.findManyInPath({
      firewallId: this._firewall.id,
      fwcloudId: this._fwCloud.id,
    })) as unknown as HAProxyGroup[];

    return ResponseBuilder.buildResponse().status(200).body(groups);
  }

  @Validate(DHCPGroupControllerCreateDto)
  async create(request: Request): Promise<ResponseBuilder> {
    (await HAProxyGroupPolicy.create(this._firewall, request.session.user)).authorize();

    const group: HAProxyGroup = await this._haproxyGroupService.create({
      firewallId: this._firewall.id,
      name: request.body.name,
      style: request.body.style,
      rules: request.inputs.get<number[]>('rules')?.map((id: number): { id: number } => ({ id })),
    });

    if (request.inputs.get<number[]>('rules')) {
      await this._haproxyRuleService.bulkUpdate(request.inputs.get<number[]>('rules'), {
        group: group.id,
      });
    }

    return ResponseBuilder.buildResponse().status(201).body(group);
  }

  @Validate()
  async show(request: Request): Promise<ResponseBuilder> {
    (await HAProxyGroupPolicy.show(this._haproxyGroup, request.session.user)).authorize();

    return ResponseBuilder.buildResponse().status(200).body(this._haproxyGroup);
  }

  @Validate(DHCPGroupControllerUpdateDto)
  async update(request: Request): Promise<ResponseBuilder> {
    (await HAProxyGroupPolicy.show(this._haproxyGroup, request.session.user)).authorize();

    const group: HAProxyGroup = await this._haproxyGroupService.update(
      this._haproxyGroup.id,
      request.inputs.all(),
    );

    return ResponseBuilder.buildResponse().status(200).body(group);
  }

  @Validate()
  async remove(request: Request): Promise<ResponseBuilder> {
    (await HAProxyGroupPolicy.show(this._haproxyGroup, request.session.user)).authorize();

    await this._haproxyGroupService.remove({ id: this._haproxyGroup.id });

    return ResponseBuilder.buildResponse().status(200).body(this._haproxyGroup);
  }
}
