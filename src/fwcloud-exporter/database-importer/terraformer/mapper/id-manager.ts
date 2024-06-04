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

import Model from "../../../../models/Model";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { QueryRunner } from "typeorm";

export type TableIdState = {
  [tableName: string]: { [propertyName: string]: number };
};

export class IdManager {
  protected _ids: TableIdState;

  protected constructor(ids: TableIdState) {
    this._ids = ids;
  }

  public getIdState(): TableIdState {
    return this._ids;
  }

  getNewId(tableName: string, propertyName: string): number {
    if (this._ids[tableName] && this._ids[tableName][propertyName]) {
      this._ids[tableName][propertyName]++;
      return this._ids[tableName][propertyName] - 1;
    }

    return null;
  }

  public static restore(ids: TableIdState): IdManager {
    return new this(ids);
  }

  /**
   * Builds an IdManager getting the new ids through the database
   *
   * @param queryRunner
   * @param tableNames
   */
  public static async make(
    queryRunner: QueryRunner,
    tableNames: Array<string>,
  ): Promise<IdManager> {
    const ids: TableIdState = {};

    for (let i = 0; i < tableNames.length; i++) {
      const tableName: string = tableNames[i];
      const entity: typeof Model = Model.getEntitiyDefinition(tableName);

      // If the tableName does not have a model, we consider it is a many to many "related-table" thus it does not have
      // a primary key (only foreign keys).
      if (entity) {
        const primaryKeys: Array<ColumnMetadataArgs> = entity.getPrimaryKeys();

        for (let i = 0; i < primaryKeys.length; i++) {
          if (!entity.isJoinColumn(primaryKeys[i].propertyName)) {
            if ((<Function>primaryKeys[i].options.type).name === "Number") {
              const primaryKeyPropertyName: string =
                primaryKeys[i].propertyName;
              // TypeORM might apply some kind of propertyName mapping.
              const originalColumnName: string = primaryKeys[i].options.name
                ? primaryKeys[i].options.name
                : primaryKeyPropertyName;

              const queryBuilder = queryRunner.manager
                .createQueryBuilder(tableName, tableName)
                .select(`MAX(${originalColumnName})`, "id");

              // If the table is empty, the returned value is null. We set 0 because it will be incremented afterwards
              const id = (await queryBuilder.execute())[0]["id"] || 0;

              ids[tableName] = {};
              ids[tableName][primaryKeyPropertyName] = id ? id + 1 : 1;
            }
          }
        }
      }
    }

    return new IdManager(ids);
  }
}
