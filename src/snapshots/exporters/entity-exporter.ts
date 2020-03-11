import { getMetadataArgsStorage } from "typeorm"
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs"
import Model from "../../models/Model";
import { FwCloudExporter } from "./fwcloud-exporter";
import { SnapshotData } from "../snapshot-data";

export class EntityExporter<T extends Model> {
    protected _entity: Function;
    protected _instance: T;
    protected _result: SnapshotData;

    protected _ignoreProperties = [];

    constructor(result: SnapshotData, instance: T) {
        this._result = result;
        this.setInstance(instance);
    }

    private _exporters = {
        FwCloud: FwCloudExporter
    }

    protected setInstance(instance: T){
        this._instance = instance;
        this._entity = instance.constructor;
    };

    protected getEntityColumns(): any {
        return getMetadataArgsStorage().columns.filter((column: ColumnMetadataArgs) => {
            return column.target === this._entity
        })
    }

    public async export(): Promise<SnapshotData> {
        if (!this._result.hasItem(this._entity, this._instance)) {
            return await this.exportEntity();
        }

        return this._result;
    }

    protected async exportEntity(): Promise<SnapshotData> {
        throw new Error('Not implemented');
    };

    public exportToJSON<T>(): Partial<T> {
        const result = {};
        const propertyReferences: Array<ColumnMetadataArgs> = this.getEntityColumns();

        for(let i = 0; i < propertyReferences.length; i++) {
            const propertyName: string = propertyReferences[i].propertyName;

            if (this._ignoreProperties.indexOf(propertyName) < 0) {
                result[propertyName] = this._instance.hasOwnProperty(propertyName) ?
                this._instance[propertyName] : null;
            }
        }

        return result;
    }
}