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
        this._result.addItem(this._instance);

        const relations: Array<RelationMetadataArgs> = this._instance.getEntityRelations();

        const primaryKeysMetadata: Array<ColumnMetadataArgs> = this._instance.getPrimaryKeys();

        const repository: Repository<typeof Model> = (await app().getService<RepositoryService>(RepositoryService.name)).for(this._entity);

        const obj = await repository.findOne(this.generateFindOnePrimaryKeys(primaryKeysMetadata, this._instance.toJSON()), this.generateFindOptionsWithAllRelations(relations));

        for(let i = 0; i < relations.length; i++) {
            if (!this.shouldIgnoreRelation(relations[i])) {
                this._result.merge(await this.exportRelationEntity(obj, relations[i]));
            }
        }

        return this._result;
    };

    protected shouldIgnoreRelation(relation: RelationMetadataArgs): boolean {
        return this._ignoreRelations.indexOf(relation.propertyName) >= 0
    }

    protected async exportRelationEntity(obj: any, relation : RelationMetadataArgs): Promise<SnapshotData> {
        if (relation.relationType === 'one-to-many' || relation.relationType === 'many-to-many') {
            let relatedObjects: Array<typeof Model> | typeof Model = obj[relation.propertyName];
            
            if (this.shouldFilterRelation(relation.propertyName)) {
                relatedObjects = await this._customRelationFilters[relation.propertyName](obj[relation.propertyName]);
            }
            
            for(let i = 0; i < obj[relation.propertyName].length; i++) {
                const exporterDefinition: typeof EntityExporter = new Exporter().buildExporterFor(obj[relation.propertyName].constructor.name);
                const exporter = new exporterDefinition(this._result, obj[relation.propertyName][i]);
                await exporter.export();
            }

            return this._result;
        }

        if (obj[relation.propertyName]) {
            const exporter = new EntityExporter(this._result, obj[relation.propertyName])
            await exporter.export();
        }

        return this._result;
    }

    protected shouldFilterRelation(propertyName: string): boolean {
        return this._customRelationFilters.hasOwnProperty(propertyName);
    }

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

    protected generateFindOnePrimaryKeys(primaryKeys: Array<ColumnMetadataArgs>, data: DeepPartial<Model>): {[k:string]: any} {
        const where = {}

        for(let i = 0; i < primaryKeys.length; i++) {
            if (data[primaryKeys[i].propertyName]) {
                where[primaryKeys[i].propertyName] = data[primaryKeys[i].propertyName];
            }
        }

        return where;
    }
}