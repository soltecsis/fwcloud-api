/*
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

import { DeepPartial, getMetadataArgsStorage } from "typeorm";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import ObjectHelpers from "../utils/object-helpers";

export interface IModel {
    getTableName(): string;
    getEntityColumns(): Array<ColumnMetadataArgs>;
    getEntityRelations(): Array<RelationMetadataArgs>;
}

export interface ToJSONOptions {
    removeNullFields: boolean;
}

const defaultToJSONOptions: ToJSONOptions = {
    removeNullFields: false
}

export default abstract class Model implements IModel {
    public abstract getTableName(): string;

    public static methodExists(method: string): boolean {
        return typeof this[method] === 'function' || typeof this.prototype[method] === 'function';
    }

    public toJSON<T>(options: ToJSONOptions = defaultToJSONOptions): DeepPartial<T> {
        const result = {};
        const propertyReferences: Array<ColumnMetadataArgs> = this.getEntityColumns();

        options = <ToJSONOptions>ObjectHelpers.merge(defaultToJSONOptions, options);

        for(let i = 0; i < propertyReferences.length; i++) {
            const propertyName: string = propertyReferences[i].propertyName;
            if (this.hasOwnProperty(propertyName) && this[propertyName] !== null) {
                result[propertyName] = this[propertyName];
                continue;
            }

            if (this.hasOwnProperty(propertyName) && !this[propertyName] && options.removeNullFields === false) {
                result[propertyName] = null;
            }
        }

        return result;
    }

    public getEntityColumns(): Array<ColumnMetadataArgs> {
        return getMetadataArgsStorage().columns.filter((column: ColumnMetadataArgs) => {
            return column.target === this.constructor;
        })
    }

    public getEntityRelations(): Array<RelationMetadataArgs> {
        return getMetadataArgsStorage().relations.filter((relation: RelationMetadataArgs) => {
            const type = <any>relation.type;
            return relation.target === this.constructor || type().constructor === this.constructor;
        })
    }

    public getPrimaryKeys(): Array<ColumnMetadataArgs> {
        return getMetadataArgsStorage().columns.filter((column: ColumnMetadataArgs) => {
            return column.target === this.constructor && column.options.primary === true;
        })
    }

    public async onCreate(): Promise<void> { }

    public async onUpdate(): Promise<void> { }

    public async onDelete(): Promise<void> { }
}