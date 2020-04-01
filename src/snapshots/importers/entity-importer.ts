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

import { RepositoryService } from "../../database/repository.service";
import { app } from "../../fonaments/abstract-application";
import { DeepPartial, Repository, getMetadataArgsStorage } from "typeorm";
import Model from "../../models/Model";
import { ImportMapping, IdMap, EntityMap } from "../import-mapping";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { Snapshot } from "../snapshot";

type ModelClass = typeof Model;
export interface Modelable extends ModelClass {};

export class EntityImporter<T extends Model> {
    protected _instance: T;
    protected _snapshot: Snapshot;

    constructor(snapshot: Snapshot) {
        this._snapshot = snapshot;
    }

    public async import(tableName: string, entityName: string, data: DeepPartial<T>, mapper: ImportMapping, ... context: Array<any>): Promise<void> {
        
        let argsEntity: TableMetadataArgs = this.getEntity(tableName, entityName);
        const target = <any>argsEntity.target;
        this._instance = new target();

        const maps: Array<EntityMap> = [];

        const relations: Array<RelationMetadataArgs> = this._instance.getEntityRelations();
        const primaryKeysMetadata: Array<ColumnMetadataArgs> = this._instance.getPrimaryKeys();
        const original: DeepPartial<T> = data;

        for(let i = 0; i < primaryKeysMetadata.length; i++) {
            const propertyName = primaryKeysMetadata[i].propertyName;
            const map: Partial<IdMap> = {};
            map[propertyName] = {
                old: data[propertyName],
                new: null
            }
            mapper.newItem(this._instance.getTableName(), map);
            maps.push(map);
            delete data[propertyName];
        }

        data = this.customAttributeChanges(data);

        const repositoryService: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name);
        const entityRepository: Repository<any> = repositoryService.for(target);
        const created_entity: any = entityRepository.create(data);
        await entityRepository.save(created_entity);

        for(let i = 0; i < primaryKeysMetadata.length; i++) {
            const propertyName = primaryKeysMetadata[i].propertyName;
            const map: Partial<IdMap> = {};
            map[propertyName] = {
                old: original[propertyName],
                new: created_entity[propertyName]
            }

            mapper.newItem(this._instance.getTableName(), map);
        }
    }

    protected customAttributeChanges(data: DeepPartial<T>): DeepPartial<T> {
        return data;
    }

    protected getEntity(tableName: string, entityName: string): any {
        const matches: Array<TableMetadataArgs> = getMetadataArgsStorage().tables.filter((item: TableMetadataArgs) => {
            const target = <any>item.target;
            return tableName === item.name && entityName === target.name;
        });

        return matches.length > 0 ? matches[0]: null;
    }
}