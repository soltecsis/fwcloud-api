/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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
import { Validate, ValidateQuery } from '../../../decorators/validate.decorator';
import { WireGuardControllerInstallerDto } from './dtos/installer.dto';
import { Firewall } from '../../../models/firewall/Firewall';
import { FwCloud } from '../../../models/fwcloud/FwCloud';

import { HistoryQueryDto } from './dtos/history-query.dto';
import db from '../../../database/database-manager';
import { WireGuardPolicy } from '../../../policies/wireguard.policy';
import { WireGuard } from '../../../models/vpn/wireguard/WireGuard';
import { WireGuardService } from '../../../models/vpn/wireguard/wireguard.service';
import {
  FindResponse,
  GraphDataResponse,
} from '../../../models/vpn/openvpn/status/openvpn-status-history.service';
import {
  FindWireGuardStatusHistoryOptions,
  WireGuardStatusHistoryService,
  GraphWireGuardStatusHistoryOptions,
} from '../../../models/vpn/wireguard/status/wireguard-status-history.service';
import { GraphQueryDto } from './dtos/graph-query.dto';

export class WireGuardController extends Controller {
  protected _wireGuard: WireGuard;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;

  public async make(request: Request): Promise<void> {
    if (request.params.wireGuard) {
      this._wireGuard = await db
        .getSource()
        .manager.getRepository(WireGuard)
        .findOneOrFail({ where: { id: parseInt(request.params.wireGuard) } });
    }

    const firewallQueryBuilder = db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.id = :id', { id: parseInt(request.params.firewall) });
    if (request.params.wireGuard) {
      firewallQueryBuilder.innerJoin(
        'firewall.wireGuards',
        'wireGuard',
        'wireGuard.id = :wireGuard',
        {
          wireGuard: parseInt(request.params.wireGuard),
        },
      );
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

  @Validate(WireGuardControllerInstallerDto)
  public async installer(req: Request): Promise<ResponseBuilder> {
    const wireGuard: WireGuard = await db
      .getSource()
      .manager.getRepository(WireGuard)
      .createQueryBuilder('wireGuard')
      .leftJoinAndSelect('wireGuard.firewall', 'firewall')
      .leftJoinAndSelect('firewall.fwCloud', 'fwcloud')
      .where('fwcloud.id = :fwcloudId', { fwcloudId: parseInt(req.params.fwcloud) })
      .andWhere('firewall.id = :firewallId', { firewallId: parseInt(req.params.firewall) })
      .andWhere('wireGuard.id = :wireGuardId', { wireGuardId: parseInt(req.params.wireGuard) })
      .andWhere('wireGuard.wireGuard IS NOT NULL')
      .getOne();

    if (!wireGuard) {
      throw new NotFoundException();
    }

    const serverWireGuard: WireGuard = await db
      .getSource()
      .manager.getRepository(WireGuard)
      .createQueryBuilder('wireGuard')
      .leftJoinAndSelect('wireGuard.firewall', 'firewall')
      .leftJoinAndSelect('firewall.fwCloud', 'fwcloud')
      .where('fwcloud.id = :fwcloudId', { fwcloudId: parseInt(req.params.fwcloud) })
      .andWhere('firewall.id = :firewallId', { firewallId: parseInt(req.params.firewall) })
      .andWhere('wireGuard.id = :wireGuardId', { wireGuardId: WireGuard.parentId })
      .andWhere('wireGuard.wireGuard IS NULL')
      .getOne();

    if (!serverWireGuard) {
      throw new NotFoundException();
    }

    (await WireGuardPolicy.installer(wireGuard, req.session.user)).authorize();

    const exePath: string = await (
      await this._app.getService<WireGuardService>(WireGuardService.name)
    ).generateInstaller(
      req.body.connection_name,
      wireGuard,
      this.generateTemporaryPath('fwcloud-vpn.exe'),
    );

    setTimeout(() => {
      if (FSHelper.directoryExistsSync(path.dirname(exePath))) {
        FSHelper.rmDirectorySync(path.dirname(exePath));
      }
    }, 30000);

    return ResponseBuilder.buildResponse().status(201).download(exePath, 'fwcloud-vpn.exe');
  }

  @ValidateQuery(HistoryQueryDto)
  @Validate()
  public async history(req: Request): Promise<ResponseBuilder> {
    const wireGuard: WireGuard = await this.getWireGuardServerOrFail(
      parseInt(req.params.fwcloud),
      parseInt(req.params.firewall),
      parseInt(req.params.wireGuard),
    );

    (await WireGuardPolicy.history(wireGuard, req.session.user)).authorize();

    const options: FindWireGuardStatusHistoryOptions = this.buildOptions(req.query);

    const historyService: WireGuardStatusHistoryService =
      await app().getService<WireGuardStatusHistoryService>(WireGuardStatusHistoryService.name);
    const results: FindResponse = await historyService.history(wireGuard.id, options);

    return ResponseBuilder.buildResponse().status(200).body(results);
  }

  @ValidateQuery(GraphQueryDto)
  @Validate()
  public async graph(req: Request): Promise<ResponseBuilder> {
    const wireGuard: WireGuard = await this.getWireGuardServerOrFail(
      parseInt(req.params.fwcloud),
      parseInt(req.params.firewall),
      parseInt(req.params.wireGuard),
    );

    (await WireGuardPolicy.history(wireGuard, req.session.user)).authorize();

    const options: GraphWireGuardStatusHistoryOptions = this.buildOptions(req.query);

    if (req.query.limit) {
      options.limit = parseInt(req.query.limit as string);
    }

    const historyService: WireGuardStatusHistoryService =
      await app().getService<WireGuardStatusHistoryService>(WireGuardStatusHistoryService.name);
    const results: GraphDataResponse = await historyService.graph(wireGuard.id, options);

    return ResponseBuilder.buildResponse().status(200).body(results);
  }

  /**
   * Returns a temporary path where installer can be placed
   *
   * @param filename
   */
  protected generateTemporaryPath(filename: string): string {
    return path.join(app().config.get('tmp.directory'), uuid.v4(), filename);
  }

  protected getWireGuardServerOrFail(
    fwcloudId: number,
    firewallId: number,
    wireGuardId: number,
  ): Promise<WireGuard> {
    return db
      .getSource()
      .manager.getRepository(WireGuard)
      .createQueryBuilder('wireGuard')
      .innerJoinAndSelect('wireGuard.firewall', 'firewall')
      .innerJoinAndSelect('firewall.fwCloud', 'fwcloud')
      .innerJoin('wireGuard.crt', 'crt')
      .where('fwcloud.id = :fwcloudId', { fwcloudId })
      .andWhere('firewall.id = :firewallId', { firewallId })
      .andWhere('wireGuard.id = :wireGuardId', { wireGuardId })
      .andWhere('wireGuard.parentId IS NULL')
      .andWhere('crt.type =  2')
      .getOneOrFail();
  }

  protected buildOptions(query: Record<string, unknown>): FindWireGuardStatusHistoryOptions {
    const options: FindWireGuardStatusHistoryOptions = {
      rangeTimestamp: [new Date(0), new Date()],
    };

    if (query.starts_at) {
      options.rangeTimestamp[0] = new Date(parseInt(query.starts_at as string));
    }

    if (query.ends_at) {
      options.rangeTimestamp[1] = new Date(parseInt(query.ends_at as string));
    }

    if (query.name) {
      options.name = query.name as string;
    }

    if (query.address) {
      options.address = query.address as string;
    }

    return options;
  }
}
