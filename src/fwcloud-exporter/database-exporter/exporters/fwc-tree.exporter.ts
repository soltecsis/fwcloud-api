/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { TableExporter } from './table-exporter';
import Model from '../../../models/Model';
import { FwcTree } from '../../../models/tree/fwc-tree.model';
import {
  SelectQueryBuilder,
  Connection,
  QueryRunner,
  In,
  IsNull,
} from 'typeorm';

export class FwcTreeExporter extends TableExporter {
  protected _ids: Array<number>;

  protected getEntity(): typeof Model {
    return FwcTree;
  }

  public async bootstrap(connection: Connection, fwcloudId: number) {
    this._ids = await FwcTreeExporter.getNodesId(connection, fwcloudId);
  }

  public getFilterBuilder(
    qb: SelectQueryBuilder<any>,
    alias: string,
    fwCloudId: number,
  ): SelectQueryBuilder<any> {
    if (this._ids.length > 0) {
      return qb.whereInIds(this._ids);
    }

    //As this._ids is empty, then we return a query which returns an empty set of rows
    return qb.whereInIds([-1]);
  }

  /**
   * Get all node ids which are required by the fwcloud.
   *
   * @param connection
   * @param fwCloudId
   */
  public static async getNodesId(
    connection: Connection,
    fwCloudId: number,
  ): Promise<Array<number>> {
    const queryRunner: QueryRunner = connection.createQueryRunner();
    let ids: Array<number> = [];

    const parents: Array<FwcTree> = await FwcTree.find({
      where: { fwCloudId: fwCloudId, parentId: IsNull() },
    });

    ids = ids.concat(
      parents.map((item: FwcTree) => {
        return item.id;
      }),
    );

    ids = ids.concat(await this.getChildNodeIds(queryRunner, fwCloudId, ids));

    await queryRunner.release();
    return ids;
  }

  protected static async getChildNodeIds(
    qr: QueryRunner,
    fwCloudId: number,
    ids: Array<number>,
  ): Promise<Array<number>> {
    if (ids.length === 0) {
      return [];
    }

    let childIds: Array<number> = (
      await FwcTree.find({ where: { parentId: In(ids) } })
    ).map((row: FwcTree) => {
      return row.id;
    });

    if (childIds.length > 0) {
      childIds = childIds.concat(
        await this.getChildNodeIds(qr, fwCloudId, childIds),
      );
    }

    return childIds;
  }
}
