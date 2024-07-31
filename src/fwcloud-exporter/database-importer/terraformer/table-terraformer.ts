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

import { ImportMapping } from './mapper/import-mapping';
import Model from '../../../models/Model';
import { ColumnMetadataArgs } from 'typeorm/metadata-args/ColumnMetadataArgs';
import { JoinTableMetadataArgs } from 'typeorm/metadata-args/JoinTableMetadataArgs';
import { getMetadataArgsStorage } from 'typeorm';
import { RelationMetadataArgs } from 'typeorm/metadata-args/RelationMetadataArgs';
import { EventEmitter } from 'typeorm/platform/PlatformTools';
import { ProgressPayload } from '../../../sockets/messages/socket-message';

export type TerraformHandler = (mapper: ImportMapping, row: object, value: any) => number;

export type TerraformHandlerCollection = { [id: string]: TerraformHandler };

export class TableTerraformer {
  protected _mapper: ImportMapping;
  protected _customHandlers: TerraformHandlerCollection;

  protected constructor(
    mapper: ImportMapping,
    protected readonly eventEmitter: EventEmitter = new EventEmitter(),
  ) {
    this._mapper = mapper;
    this._customHandlers = this.getCustomHandlers();
  }

  public static async make(
    mapper: ImportMapping,
    eventEmitter: EventEmitter = new EventEmitter(),
  ): Promise<TableTerraformer> {
    return new Promise((resolve) => {
      const terraformer: TableTerraformer = new TableTerraformer(mapper, eventEmitter);
      resolve(terraformer);
    });
  }

  /**
   * For a given exporter result, terraform will map the current ids exported for non used ids in the current database
   *
   * @param exportResults
   */
  public async terraform(tableName: string, rows: Array<object>): Promise<Array<object>> {
    const entity: typeof Model = Model.getEntitiyDefinition(tableName);

    if (entity) {
      return await this.terraformTableDataWithEntity(this._mapper, tableName, entity, rows);
    }

    return await this.terraformTableDataWithoutEntity(this._mapper, tableName, rows);
  }

  /**
   * Terraforms a table which is modelized by an entity
   *
   * @param mapper
   * @param tableName
   * @param entity
   * @param rows
   */
  protected async terraformTableDataWithEntity(
    mapper: ImportMapping,
    tableName: string,
    entity: typeof Model,
    rows: Array<object>,
  ): Promise<Array<object>> {
    return new Promise((resolve) => {
      const result: Array<object> = [];

      let lastHeartbeat = new Date();
      this.eventEmitter.emit('message', new ProgressPayload('heartbeat', false, '', null));

      for (let i = 0; i < rows.length; i++) {
        const row: object = rows[i];

        for (const attributeName in row) {
          if (this.hasCustomHandler(attributeName)) {
            row[attributeName] = this._customHandlers[attributeName](
              mapper,
              row,
              row[attributeName],
            );
          } else {
            if (entity.isPrimaryKey(attributeName) && !entity.isForeignKey(attributeName)) {
              if (entity.getPrimaryKey(attributeName).options.type === Number) {
                // If the attribute is a primary key, it must be terraformed
                row[attributeName] = mapper.getMappedId(
                  tableName,
                  attributeName,
                  row[attributeName],
                );
              }
            }

            if (entity.isForeignKey(attributeName)) {
              //If the attribute is constrained by a foreign key, the attribute value must be terraformed
              // based on the table which it references

              const relation = entity.getRelationFromPropertyName(attributeName);
              if (relation) {
                const type: typeof Model = <typeof Model>(<any>relation.type)();
                const relatedTableName: string = type._getTableName();
                const primaryKey: ColumnMetadataArgs = type.getPrimaryKeys()[0];

                if (type.getPrimaryKey(primaryKey.propertyName).options.type === Number) {
                  // If the attribute is a primary key, it must be terraformed
                  row[attributeName] = mapper.getMappedId(
                    relatedTableName,
                    primaryKey.propertyName,
                    row[attributeName],
                  );
                }
              }
            }
          }

          if (new Date().getTime() - lastHeartbeat.getTime() > 20000) {
            lastHeartbeat = new Date();
            this.eventEmitter.emit('message', new ProgressPayload('heartbeat', false, '', null));
          }
        }
        result.push(row);
      }

      resolve(result);
    });
  }

  /**
   * Adapts data to import to the current database. Data without entity belongs to tables which are not mapped
   * into a model (usually many-to-many relation tables as an entity is not required for this kind of tables and
   * the TypeORM metadata is limited).
   *
   * @param mapper
   * @param tableName
   * @param rows
   */
  protected async terraformTableDataWithoutEntity(
    mapper: ImportMapping,
    tableName: string,
    rows: Array<object>,
  ): Promise<Array<object>> {
    return new Promise((resolve, reject) => {
      const result: Array<object> = [];
      const joinTables: Array<JoinTableMetadataArgs> = getMetadataArgsStorage().joinTables.filter(
        (item: JoinTableMetadataArgs) => {
          return item.name === tableName;
        },
      );

      const joinTable: JoinTableMetadataArgs = joinTables.length > 0 ? joinTables[0] : null;

      if (!joinTable) {
        reject(new Error('Join table metadata not found for ' + tableName));
      }
      const target: typeof Model = <any>joinTable.target;
      const relation: RelationMetadataArgs = target.getRelationFromPropertyName(
        joinTable.propertyName,
      );
      const joinColumnName: string = joinTable.joinColumns[0].name;

      const relatedTarget: typeof Model = <typeof Model>(<any>relation.type)();
      const relatedColumnName: string = joinTable.inverseJoinColumns[0].name;

      let lastHeartbeat = new Date();
      this.eventEmitter.emit('message', new ProgressPayload('heartbeat', false, '', null));

      for (let i = 0; i < rows.length; i++) {
        const row: object = rows[i];

        for (const attributeName in row) {
          if (attributeName === joinColumnName) {
            row[attributeName] = mapper.getMappedId(
              target._getTableName(),
              target.getPrimaryKeys()[0].propertyName,
              row[attributeName],
            );
          }

          if (attributeName === relatedColumnName) {
            row[attributeName] = mapper.getMappedId(
              relatedTarget._getTableName(),
              relatedTarget.getPrimaryKeys()[0].propertyName,
              row[attributeName],
            );
          }

          if (new Date().getTime() - lastHeartbeat.getTime() > 20000) {
            lastHeartbeat = new Date();
            this.eventEmitter.emit('message', new ProgressPayload('heartbeat', false, '', null));
          }
        }
        result.push(row);
      }

      resolve(result);
    });
  }

  /**
   * Returns whether a given attribute has a custom handler
   *
   * @param tableName
   * @param entityName
   * @param attributeName
   */
  protected hasCustomHandler(attributeName: string) {
    return attributeName in this._customHandlers;
  }

  /**
   * Returns custom handler for a given table attribute
   */
  protected getCustomHandlers(): TerraformHandlerCollection {
    return {};
  }
}
