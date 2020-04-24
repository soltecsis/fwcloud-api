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

import { DeepPartial, getMetadataArgsStorage, Column } from "typeorm";
import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import ObjectHelpers from "../utils/object-helpers";
import { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { JoinColumnMetadataArgs } from "typeorm/metadata-args/JoinColumnMetadataArgs";
import { JoinTableMetadataArgs } from "typeorm/metadata-args/JoinTableMetadataArgs";

export interface IModel {
    getTableName(): string;
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

    public static _getTableName(): string {
        const sampleInstance: Model = new (<any>this);
        return sampleInstance.getTableName();
    }

    /**
     * Returns the model class definition for the given tableName and entityName
     * 
     * @param tableName 
     * @param entityName 
     */
    public static getEntitiyDefinition(tableName: string, entityName?: string): typeof Model {
        const matches: Array<TableMetadataArgs> = getMetadataArgsStorage().tables.filter((item: TableMetadataArgs) => {
            const target = <any>item.target;
            return tableName === item.name && ( !entityName || (entityName && entityName === target.name));
        });

        return matches.length > 0 ? <any>matches[0].target : null;
    }

    /**
     * Export all database columns as JSON
     * 
     * @param options 
     */
    public toJSON<T>(options: ToJSONOptions = defaultToJSONOptions): DeepPartial<T> {
        const result = {};
        const propertyReferences: Array<ColumnMetadataArgs> = (<typeof Model>(<any>this.constructor)).getEntityColumns();

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

    /**
     * Returns model properties which are Column
     */
    public static getEntityColumns(): Array<ColumnMetadataArgs> {
        return getMetadataArgsStorage().columns.filter((column: ColumnMetadataArgs) => {
            return column.target === this;
        })
    }

    /**
     * Returns model relations
     */
    public static getEntityRelations(): Array<RelationMetadataArgs> {
        return getMetadataArgsStorage().relations.filter((relation: RelationMetadataArgs) => {
            const type = <any>relation.type;
            return relation.target === this || type().constructor === this;
        })
    }

    /**
     * Returns model primary keys
     */
    public static getPrimaryKeys(): Array<ColumnMetadataArgs> {
        return getMetadataArgsStorage().columns.filter((column: ColumnMetadataArgs) => {
            return column.target === this && column.options.primary === true;
        })
    }

    public static getPrimaryKey(propertyName: string): ColumnMetadataArgs {
        const primaryKeys: Array<ColumnMetadataArgs> = this.getPrimaryKeys().filter((column: ColumnMetadataArgs) => {
            return column.propertyName === propertyName;
        });

        if (primaryKeys.length === 0) {
            return null;
        }

        return primaryKeys[0];
    }

    /**
     * Returns whether a propertyName is a primary key
     * 
     * @param propertyName 
     */
    public static isPrimaryKey(propertyName: string): boolean {
        return this.getPrimaryKeys().filter((item: ColumnMetadataArgs) => {
            return item.propertyName === propertyName;
        }).length > 0;
    }

    /**
     * Returns model join columns
     */
    public static getJoinColumns(): Array<JoinColumnMetadataArgs> {
        return getMetadataArgsStorage().joinColumns.filter((item: JoinColumnMetadataArgs) => {
            return item.target === this;
        });
    }

    public static getJoinTables(): Array<JoinTableMetadataArgs> {
        return getMetadataArgsStorage().joinTables.filter((item: JoinTableMetadataArgs) => {
            return item.target === this;
        });
    }

    /**
     * Returns whether the property is the join column (relationName property)
     * 
     * @param propertyName 
     */
    public static isJoinColumn(propertyName: string): boolean {
        return this.getJoinColumns().filter((item: JoinColumnMetadataArgs) => {
            return item.propertyName === propertyName;
        }).length > 0;
    }

    /**
     * Returns whether a model property is a join table
     * @param propertyName 
     */
    public static isJoinTable(propertyName: string): boolean {
        return this.getJoinTables().filter((item: JoinTableMetadataArgs) => {
            return item.propertyName === propertyName;
        }).length > 0;
    }

    /**
     * Returns whether the property is the property which references to other table (usually relationNameId properties)
     * @param propertyName 
     */
    public static isForeignKey(propertyName: string): boolean {
        //First get the column metadata argument of the propertyName
        const columnMetadatas: Array<ColumnMetadataArgs> = this.getEntityColumns().filter((item: ColumnMetadataArgs) => {
            return item.propertyName === propertyName || (item.options.name ? item.options.name === propertyName : false)
        });

        if (columnMetadatas.length === 0) {
            return false;
        }

        if (columnMetadatas.length > 1) {
            throw new Error('Unexpected metadata length');
        }

        return this.getJoinColumns().filter((item: JoinColumnMetadataArgs) => {
            return item.name === (columnMetadatas[0].options.name ? columnMetadatas[0].options.name: columnMetadatas[0].propertyName);
        }).length > 0;
    }

    /**
     * Returns the column name of a property name which has Column annotation
     * @param propertyName 
     */
    public static getOriginalColumnName(propertyName: string): string {
        const matchingColumns: Array<ColumnMetadataArgs> = this.getEntityColumns().filter((item: ColumnMetadataArgs) => {
            return item.propertyName === propertyName || (item.options.name ? item.options.name === propertyName : false);
        });

        if (matchingColumns.length > 1) {
            throw new Error('Unexpected metadata length');
        }

        if (matchingColumns.length === 0) {
            return null;
        }

        return matchingColumns[0].options.name ? matchingColumns[0].options.name : matchingColumns[0].propertyName;
    }

    /**
     * Returns the relation from a property which is ForeignKey (usually relationNameId)
     * @param propertyName 
     */
    public static getRelationFromPropertyName(propertyName: string): RelationMetadataArgs {
        if (this.isForeignKey(propertyName)) {
            return this.getRelationFromForeignKey(propertyName);
        }

        if (this.isJoinTable(propertyName)) {
            return this.getRelationFromJoinTable(propertyName);
        }
    }

    /**
     * Returns the relation which references the foreign key propertyName
     * 
     * @param propertyName 
     */
    protected static getRelationFromForeignKey(propertyName: string): RelationMetadataArgs {
        const originalColumName: string = this.getOriginalColumnName(propertyName);

        const joinColumns: Array<JoinColumnMetadataArgs> = this.getJoinColumns().filter((item: JoinColumnMetadataArgs) => {
            return item.name === originalColumName
        });

        if (joinColumns.length === 1 ) {
            const matchRelations = this.getEntityRelations().filter((item: RelationMetadataArgs) => {
                return item.propertyName === joinColumns[0].propertyName;
            });

            if (joinColumns.length === 1) {
                return matchRelations[0];
            }
        }

        return null;
    }

    /**
     * Returns the relation which references the join table propertyName
     * @param propertyName 
     */
    protected static getRelationFromJoinTable(propertyName: string): RelationMetadataArgs {
        const relations: Array<RelationMetadataArgs> = this.getEntityRelations().filter((item: RelationMetadataArgs) => {
            return item.propertyName === propertyName
        });

        if (relations.length !== 1) {
            throw new Error('Unexpected metadata length');
        }

        return relations[0];
    }

    public async onCreate(): Promise<void> { }

    public async onUpdate(): Promise<void> { }

    public async onDelete(): Promise<void> { }
}