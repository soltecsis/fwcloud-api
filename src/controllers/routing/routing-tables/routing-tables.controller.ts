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
import { Firewall } from '../../../models/firewall/Firewall';
import {
  RouteData,
  RoutingTableService,
} from '../../../models/routing/routing-table/routing-table.service';
import { Request } from 'express';
import { RoutingTable } from '../../../models/routing/routing-table/routing-table.model';
import { ResponseBuilder } from '../../../fonaments/http/response-builder';
import {
  Validate,
  ValidateQuery,
} from '../../../decorators/validate.decorator';
import { RoutingTablePolicy } from '../../../policies/routing-table.policy';
import { RoutingTableControllerCreateDto } from './dtos/create.dto';
import { RoutingTableControllerUpdateDto } from './dtos/update.dto';
import { RouteItemForCompiler } from '../../../models/routing/shared';
import { RoutingCompiler } from '../../../compiler/routing/RoutingCompiler';
import { RoutingTableControllerCompileRoutesQueryDto } from './dtos/compile-routes.dto';
import { FwCloud } from '../../../models/fwcloud/FwCloud';
import { Tree } from '../../../models/tree/Tree';
import { RoutingRule } from '../../../models/routing/routing-rule/routing-rule.model';
import db from '../../../database/database-manager';

export class RoutingTableController extends Controller {
  protected routingTableService: RoutingTableService;
  protected _firewall: Firewall;
  protected _fwCloud: FwCloud;
  protected _routingTable: RoutingTable;

  public async make(request: Request): Promise<void> {
    this.routingTableService = await this._app.getService<RoutingTableService>(
      RoutingTableService.name,
    );

    //Get the routingTable
    if (request.params.routingTable) {
      this._routingTable = await db
        .getSource()
        .manager.getRepository(RoutingTable)
        .findOneOrFail({
          where: { id: parseInt(request.params.routingTable) },
        });
    }

    //Get the firewall from the URL which contains the routingTable
    const firewallQueryBuilder = db
      .getSource()
      .manager.getRepository(Firewall)
      .createQueryBuilder('firewall')
      .where('firewall.id = :id', { id: parseInt(request.params.firewall) });
    if (this._routingTable) {
      firewallQueryBuilder.innerJoin(
        'firewall.routingTables',
        'routingTable',
        'routingTable.id = :routingTableId',
        { routingTableId: this._routingTable.id },
      );
    }
    this._firewall = await firewallQueryBuilder.getOneOrFail();

    //Get the fwcloud from the URL which contains the firewall
    this._fwCloud = await db
      .getSource()
      .manager.getRepository(FwCloud)
      .createQueryBuilder('fwcloud')
      .innerJoin('fwcloud.firewalls', 'firewall', 'firewall.id = :firewallId', {
        firewallId: this._firewall.id,
      })
      .where('fwcloud.id = :id', { id: parseInt(request.params.fwcloud) })
      .getOneOrFail();
  }

  @Validate()
  async index(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.index(this._firewall, request.session.user)
    ).authorize();

    const tables: RoutingTable[] =
      await this.routingTableService.findManyInPath({
        fwCloudId: this._firewall.fwCloudId,
        firewallId: this._firewall.id,
      });

    return ResponseBuilder.buildResponse().status(200).body(tables);
  }

  @Validate()
  async show(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.show(this._routingTable, request.session.user)
    ).authorize();

    return ResponseBuilder.buildResponse().status(200).body(this._routingTable);
  }

  @Validate()
  async grid(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.show(this._routingTable, request.session.user)
    ).authorize();

    const grid = await this.routingTableService.getRoutingTableData(
      'grid',
      this._firewall.fwCloudId,
      this._firewall.id,
      this._routingTable.id,
    );

    return ResponseBuilder.buildResponse().status(200).body(grid);
  }

  @Validate()
  @ValidateQuery(RoutingTableControllerCompileRoutesQueryDto)
  async compileRoutes(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.show(this._routingTable, request.session.user)
    ).authorize();

    let routes: RouteData<RouteItemForCompiler>[] =
      await this.routingTableService.getRoutingTableData(
        'compiler',
        this._firewall.fwCloudId,
        this._firewall.id,
        this._routingTable.id,
        request.query.routes
          ? (request.query.routes as string[]).map((item) => parseInt(item))
          : undefined,
      );

    if (Array.isArray(request.query.routes)) {
      routes = routes.filter((route) =>
        (request.query.routes as string[]).includes(route.id.toString()),
      );
    }

    const compilation = new RoutingCompiler().compile('Route', routes);

    return ResponseBuilder.buildResponse().status(200).body(compilation);
  }

  @Validate(RoutingTableControllerCreateDto)
  async create(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.create(this._firewall, request.session.user)
    ).authorize();

    const routingTable: RoutingTable = await this.routingTableService.create({
      firewallId: this._firewall.id,
      name: request.inputs.get('name'),
      number: parseInt(request.inputs.get('number')),
      comment: request.inputs.get('comment'),
    });

    return ResponseBuilder.buildResponse().status(201).body(routingTable);
  }

  @Validate(RoutingTableControllerUpdateDto)
  async update(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.update(this._routingTable, request.session.user)
    ).authorize();

    const result: RoutingTable = await this.routingTableService.update(
      this._routingTable.id,
      request.inputs.all(),
    );

    // Update the tree node with the new name.
    await Tree.updateRoutingTableNodeName(
      this._firewall.fwCloudId,
      result.id,
      result.name,
    );

    return ResponseBuilder.buildResponse().status(200).body(result);
  }

  @Validate()
  async restrictions(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.show(this._routingTable, request.session.user)
    ).authorize();

    const rules: RoutingRule[] = await db
      .getSource()
      .manager.getRepository(RoutingRule)
      .createQueryBuilder('rule')
      .select('rule.id', 'routing_rule_id')
      .addSelect('table.id', 'routing_table_id')
      .addSelect('firewall.id', 'firewall_id')
      .addSelect('firewall.name', 'firewall_name')
      .addSelect('cluster.id', 'cluster_id')
      .addSelect('cluster.name', 'cluster_name')
      .innerJoin('rule.routingTable', 'table')
      .innerJoin('table.firewall', 'firewall')
      .leftJoin('firewall.cluster', 'cluster')
      .where('table.id = :id', { id: this._routingTable.id })
      .getRawMany();

    if (rules.length > 0) {
      return ResponseBuilder.buildResponse()
        .status(403)
        .body({
          restrictions: {
            routingTableUsedInRule: rules,
          },
        });
    }

    return ResponseBuilder.buildResponse().status(204);
  }

  @Validate()
  async remove(request: Request): Promise<ResponseBuilder> {
    (
      await RoutingTablePolicy.delete(this._routingTable, request.session.user)
    ).authorize();

    await this.routingTableService.remove({
      fwCloudId: this._firewall.fwCloudId,
      firewallId: this._firewall.id,
      id: this._routingTable.id,
    });

    return ResponseBuilder.buildResponse().status(200).body(this._routingTable);
  }
}
