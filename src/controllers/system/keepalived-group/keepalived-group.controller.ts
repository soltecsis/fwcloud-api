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
import { getRepository } from 'typeorm';
import { Controller } from '../../../fonaments/http/controller';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { KeepalivedGroup } from '../../../models/system/keepalived/keepalived_g/keepalived_g.model';
import { KeepalivedGroupService } from '../../../models/system/keepalived/keepalived_g/keepalived_g.service';
import { Request } from 'express';
import { KeepalivedGroupPolicy } from '../../../policies/keepalived-group.policy';
import { Validate } from '../../../decorators/validate.decorator';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { KeepalivedGroupControllerCreateDto } from './dto/create.dto';
import { KeepalivedGroupUpdateDto } from './dto/update.dto';
import { KeepalivedRuleService } from '../../../models/system/keepalived/keepalived_r/keepalived_r.service';

export class KeepalivedGroupController extends Controller {
  protected _keepalivedGroupService: KeepalivedGroupService;
  protected _keepalivedRuleService: KeepalivedRuleService;

  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  protected _keepalivedGroup: KeepalivedGroup;

  /**
   * Makes a request to create a keepalived group.
   *
   * @param request - The request object.
   * @returns A promise that resolves to void.
   */
  public async make(request: Request): Promise<void> {
    this._keepalivedGroupService =
      await this._app.getService<KeepalivedGroupService>(
        KeepalivedGroupService.name,
      );
    this._keepalivedRuleService =
      await this._app.getService<KeepalivedRuleService>(
        KeepalivedRuleService.name,
      );

    if (request.params.keepalivedgroup) {
      this._keepalivedGroup = await this._keepalivedGroupService.findOneInPath({
        id: parseInt(request.params.keepalivedgroup),
      });
    }

    this._firewall = await getRepository(Firewall).findOneOrFail(
      request.params.firewall,
    );
    this._fwCloud = await getRepository(FwCloud).findOneOrFail(
      request.params.fwcloud,
    );
  }

  @Validate()
  /**
   * Retrieves a list of Keepalived groups.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  async index(req: Request): Promise<ResponseBuilder> {
    (
      await KeepalivedGroupPolicy.index(this._firewall, req.session.user)
    ).authorize();

    const groups: KeepalivedGroup[] =
      (await this._keepalivedGroupService.findManyInPath({
        firewallId: this._firewall.id,
        fwcloudId: this._fwCloud.id,
      })) as unknown as KeepalivedGroup[];

    return ResponseBuilder.buildResponse().status(200).body(groups);
  }

  @Validate(KeepalivedGroupControllerCreateDto)
  /**
   * Creates a new KeepalivedGroup.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder.
   */
  async create(req: Request): Promise<ResponseBuilder> {
    (
      await KeepalivedGroupPolicy.create(this._firewall, req.session.user)
    ).authorize();

    const group: KeepalivedGroup = await this._keepalivedGroupService.create({
      firewallId: this._firewall.id,
      name: req.body.name,
      style: req.body.style,
      rules: req.inputs.get<number[]>('rules')?.map((id) => ({ id })),
    });

    if (req.inputs.get<number[]>('rules')) {
      await this._keepalivedRuleService.bulkUpdate(
        req.inputs.get<number[]>('rules')?.map((id) => id),
        { group: group.id },
      );
    }

    return ResponseBuilder.buildResponse().status(201).body(group);
  }

  @Validate()
  /**
   * Retrieves the keepalived group information.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  async show(req: Request): Promise<ResponseBuilder> {
    (
      await KeepalivedGroupPolicy.show(this._keepalivedGroup, req.session.user)
    ).authorize();

    return ResponseBuilder.buildResponse()
      .status(200)
      .body(this._keepalivedGroup);
  }

  @Validate(KeepalivedGroupUpdateDto)
  /**
   * Updates the keepalived group.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  async update(req: Request): Promise<ResponseBuilder> {
    (
      await KeepalivedGroupPolicy.update(
        this._keepalivedGroup,
        req.session.user,
      )
    ).authorize();

    const result = await this._keepalivedGroupService.update(
      this._keepalivedGroup.id,
      req.inputs.all(),
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  /**
   * Removes the keepalived group.
   *
   * @param req - The request object.
   * @returns A Promise that resolves to a ResponseBuilder object.
   */
  async remove(req: Request): Promise<ResponseBuilder> {
    (
      await KeepalivedGroupPolicy.remove(
        this._keepalivedGroup,
        req.session.user,
      )
    ).authorize();

    await this._keepalivedGroupService.remove({
      id: this._keepalivedGroup.id,
      firewallId: this._firewall.id,
      fwcloudId: this._fwCloud.id,
    });
    return ResponseBuilder.buildResponse()
      .status(200)
      .body(this._keepalivedGroup);
  }
}
