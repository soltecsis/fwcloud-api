/*!
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Request } from 'express';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import { NotFoundException } from '../../../fonaments/exceptions/not-found-exception';
import { FSHelper } from '../../../utils/fs-helper';
import { app } from '../../../fonaments/abstract-application';
import * as uuid from 'uuid';
import * as path from 'path';
import { Validate } from '../../../decorators/validate.decorator';
import { IPSecControllerInstallerDto } from './dtos/installer.dto';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';

import db from '../../../database/database-manager';
import { IPSecPolicy } from '../../../policies/ipsec.policy';
import { IPSec } from '../../../models/vpn/ipsec/IPSec';
import { IPSecService } from '../../../models/vpn/ipsec/ipsec.service';

export class FirewallIPSecController extends Controller {
  protected _ipsec: IPSec;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    if (request.params.ipsec) {
      this._ipsec = await db
        .getSource()
        .manager.getRepository(IPSec)
        .findOneOrFail({ where: { id: parseInt(request.params.ipsec) } });
    }

    const firewallQueryBuilder = db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.id = :id', { id: parseInt(request.params.firewall) });
    if (request.params.ipsec) {
      firewallQueryBuilder.innerJoin('firewall.ipsecs', 'ipsec', 'ipsec.id = :ipsec', {
        ipsec: parseInt(request.params.ipsec),
      });
    }
    this._firewall = await firewallQueryBuilder.getOneOrFail();

    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .createQueryBuilder('fwcloud')
      .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {
        firewallId: parseInt(request.params.firewall),
      })
      .where('fwcloud.id = :id', { id: parseInt(request.params.fwcloud) })
      .getOneOrFail();
  }

  @Validate(IPSecControllerInstallerDto)
  public async installer(req: Request): Promise<ResponseBuilder> {
    const ipsec: IPSec = await db
      .getSource()
      .manager.getRepository(IPSec)
      .createQueryBuilder('ipsec')
      .leftJoinAndSelect('ipsec.firewall', 'firewall')
      .leftJoinAndSelect('firewall.fwCloud', 'fwcloud')
      .where('fwcloud.id = :fwcloudId', { fwcloudId: parseInt(req.params.fwcloud) })
      .andWhere('firewall.id = :firewallId', { firewallId: parseInt(req.params.firewall) })
      .andWhere('ipsec.id = :ipsecId', { ipsecId: parseInt(req.params.ipsec) })
      .andWhere('ipsec.ipsec IS NOT NULL')
      .getOne();

    if (!ipsec) {
      throw new NotFoundException();
    }

    const serverIPSec: IPSec = await db
      .getSource()
      .manager.getRepository(IPSec)
      .createQueryBuilder('ipsec')
      .leftJoinAndSelect('ipsec.firewall', 'firewall')
      .leftJoinAndSelect('firewall.fwCloud', 'fwcloud')
      .where('fwcloud.id = :fwcloudId', { fwcloudId: parseInt(req.params.fwcloud) })
      .andWhere('firewall.id = :firewallId', { firewallId: parseInt(req.params.firewall) })
      .andWhere('ipsec.ipsec IS NULL')
      .getOne();

    if (!serverIPSec) {
      throw new NotFoundException();
    }

    (await IPSecPolicy.installer(ipsec, req.session.user)).authorize();

    const exePath: string = await (
      await this._app.getService<IPSecService>(IPSecService.name)
    ).generateInstaller(
      req.body.connection_name,
      ipsec,
      this.generateTemporaryPath('fwcloud-vpn.exe'),
    );

    setTimeout(() => {
      if (FSHelper.directoryExistsSync(path.dirname(exePath))) {
        FSHelper.rmDirectorySync(path.dirname(exePath));
      }
    }, 30000);

    return ResponseBuilder.buildResponse().status(201).download(exePath, 'fwcloud-vpn.exe');
  }

  /**
   * Returns a temporary path where installer can be placed
   *
   * @param filename
   */
  protected generateTemporaryPath(filename: string): string {
    return path.join(app().config.get('tmp.directory'), uuid.v4(), filename);
  }
}
