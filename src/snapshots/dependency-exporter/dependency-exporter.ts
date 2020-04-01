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