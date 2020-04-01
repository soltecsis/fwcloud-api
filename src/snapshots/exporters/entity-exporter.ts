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

import { Repository, DeepPartial, FindManyOptions, FindOneOptions } from "typeorm"
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs"
import Model from "../../models/Model";
import { SnapshotData } from "../snapshot-data";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { app } from "../../fonaments/abstract-application";
import { RepositoryService } from "../../database/repository.service";
import { Exporter } from "../exporter";

export class EntityExporter {
    protected _entity: Function;
    protected _instance: any;
    protected _result: SnapshotData;

    protected _ignoreProperties: Array<string> = [];
    protected _ignoreRelations: Array<string> = [];
    protected _customRelationFilters: {[propertyName: string]: (items: Array<any>) => Promise<Array<any>>} = {}

    constructor(result: SnapshotData, instance: any) {
        this._result = result;
        this.setInstance(instance);
    }

    protected setInstance(instance: any){
        this._instance = instance;
        this._entity = instance.constructor;
    };

    public async export(): Promise<SnapshotData> {
        if (!this._result.hasItem(this._entity, this._instance)) {
            return await this.exportEntity();
        }

        return this._result;
    }

    protected async exportEntity(): Promise<SnapshotData> {
        if (!this.shouldIgnoreThisInstance(this._instance)) {
            this._result.addItem(this._instance);

            const relations: Array<RelationMetadataArgs> = this._instance.getEntityRelations();

            const primaryKeysMetadata: Array<ColumnMetadataArgs> = this._instance.getPrimaryKeys();

            const repository: Repository<typeof Model> = (await app().getService<RepositoryService>(RepositoryService.name)).for(this._entity);

            const obj = await repository.findOne(this.generateWhereCriteriaForFindOnePrimaryKeys(primaryKeysMetadata, this._instance.toJSON()), this.generateFindOptionsWithAllRelations(relations));

            for(let i = 0; i < relations.length; i++) {
                if (!this.shouldIgnoreRelation(relations[i])) {
                    this._result.merge(await this.exportRelationEntity(obj, relations[i]));
                }
            }
        }

        return this._result;
    };

    /**
     * Returns whether the given instance should be exported
     * @param instance 
     */
    protected shouldIgnoreThisInstance(instance: any): boolean {
        return false;
    }

    /**
     * Returns whether the given relation with the entity should be exported
     * @param relation 
     */
    protected shouldIgnoreRelation(relation: RelationMetadataArgs): boolean {
        return this._ignoreRelations.indexOf(relation.propertyName) >= 0
    }

    /**
     * Export relation entities from the given instance
     * 
     * @param instance 
     * @param relation 
     */
    protected async exportRelationEntity(instance, relation : RelationMetadataArgs): Promise<SnapshotData> {
        if (relation.relationType === 'one-to-many' || relation.relationType === 'many-to-many') {
            let relatedObjects: Array<typeof Model> | typeof Model = instance[relation.propertyName];
            
            if (this.hasCustomRelations(relation.propertyName)) {
                relatedObjects = await this._customRelationFilters[relation.propertyName](instance[relation.propertyName]);
            }
            
            for(let i = 0; i < instance[relation.propertyName].length; i++) {
                const exporterDefinition: typeof EntityExporter = new Exporter().buildExporterFor(instance[relation.propertyName][i].constructor.name);
                const exporter = new exporterDefinition(this._result, instance[relation.propertyName][i]);
                await exporter.export();
            }

            return this._result;
        }

        if (instance[relation.propertyName]) {
            const exporterDefinition: typeof EntityExporter = new Exporter().buildExporterFor(instance[relation.propertyName].constructor.name);
            const exporter = new exporterDefinition(this._result, instance[relation.propertyName]);
            await exporter.export();
        }

        return this._result;
    }

    /**
     * Returns whether the given entity should customize the given propertyName which is a relation
     * @param propertyName 
     */
    protected hasCustomRelations(propertyName: string): boolean {
        return this._customRelationFilters.hasOwnProperty(propertyName);
    }

    /**
     * Returns the relation array for perform an relation eager loading.
     * 
     * @param relations 
     */
    protected generateFindOptionsWithAllRelations(relations: Array<RelationMetadataArgs>): FindOneOptions<typeof Model> {
        const options: FindManyOptions<typeof Model> = {
            relations: []
        };

        for(let i = 0; i < relations.length; i++) {
            const relation: RelationMetadataArgs = relations[i];
            options.relations.push(relation.propertyName);
        }

        return options;
    }

    /**
     * For the given primary key properties, generates the where criteria for QueryBuilder in orer to perform a FindOne operation
     * @param primaryKeys 
     * @param data 
     */
    protected generateWhereCriteriaForFindOnePrimaryKeys(primaryKeys: Array<ColumnMetadataArgs>, data: DeepPartial<Model>): {[k:string]: any} {
        const where = {}

        for(let i = 0; i < primaryKeys.length; i++) {
            if (data[primaryKeys[i].propertyName]) {
                where[primaryKeys[i].propertyName] = data[primaryKeys[i].propertyName];
            }
        }

        return where;
    }
}