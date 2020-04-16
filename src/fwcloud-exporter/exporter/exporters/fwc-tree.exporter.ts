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

import { TableExporter } from "./table-exporter";
import Model from "../../../models/Model";
import { FwcTree } from "../../../models/tree/fwc-tree.model";
import { SelectQueryBuilder, Connection, QueryRunner, QueryBuilder } from "typeorm";
import { id } from "../../../middleware/joi_schemas/shared";
import { app } from "../../../fonaments/abstract-application";
import { DatabaseService } from "../../../database/database.service";

export class FwcTreeExporter extends TableExporter {

    protected _ids: Array<number>;

    protected getEntity(): typeof Model {
        return FwcTree;
    }

    public async bootstrap(connection: Connection, fwcloudId: number) {
        this._ids = await FwcTreeExporter.getNodesId(connection, fwcloudId);
    }

    public getFilterBuilder(qb: SelectQueryBuilder<any>, alias: string, fwCloudId: number): SelectQueryBuilder<any> {
        return qb.whereInIds(this._ids);
    }

    public static async getNodesId(connection: Connection, fwCloudId: number): Promise<Array<number>> {
        const queryRunner: QueryRunner = connection.createQueryRunner();
        let ids: Array<number> = [];
        const parentIds: Array<{id: number}> = await queryRunner.query(`SELECT id FROM fwc_tree WHERE fwcloud = ? AND id_parent IS NULL`, [fwCloudId]);

        ids = ids.concat(parentIds.map((item: {id: number}) => {
            return item.id;
        }));

        for(let i = 0; i < parentIds.length; i++) {
            const childIds: Array<{id: number}> = await queryRunner.query(`
                SELECT id
                FROM (SELECT * FROM fwc_tree ft ORDER BY id_parent , id) fwc_sorted,
                    (select @pv := ?) initialisation
                WHERE FIND_IN_SET(id_parent, @pv)
                and LENGTH (@pv := concat(@pv, ',', id))
                `, [parentIds[i].id]
            );

            ids = ids.concat(childIds.map((item: {id: number}) => {
                return item.id;
            }));
        }

        await queryRunner.release();
        return ids;
    }
}