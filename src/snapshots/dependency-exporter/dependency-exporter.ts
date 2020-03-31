import { SnapshotData } from "../snapshot-data";
import Model from "../../models/Model";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";

export class DependencyExporter {

    protected _result: SnapshotData;

    constructor(result: SnapshotData) {
        this._result = result;
    }

    async export(entity: any): Promise<SnapshotData> {
        const instance = new entity();
        if (!this._result.hasSection(instance)) {
            return await this.exportEntity(instance);
        }

        return this._result;
    }

    protected async exportEntity(instance: Model): Promise<SnapshotData> {
        this._result.addSection(instance);

        const relations: Array<RelationMetadataArgs> = instance.getEntityRelations();

        for (let i = 0; i < relations.length; i++) {
            const relation = relations[i];
            const target = <any>relation.target;
            const type = <any>relation.type;

            const targetInstance = new target();
            const typeInstance = new (type())();

            if (targetInstance.constructor.name !== instance.constructor.name) {
                const depExporter: DependencyExporter = new DependencyExporter(this._result);
                this._result.merge(await depExporter.export(targetInstance.constructor));
            }

            if (typeInstance.constructor.name !== instance.constructor.name) {
                const depExporter: DependencyExporter = new DependencyExporter(this._result);
                this._result.merge(await depExporter.export(typeInstance.constructor));
            }
        }

        return this._result;
    }
}