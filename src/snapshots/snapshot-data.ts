import { DeepPartial } from "typeorm";
import Model from "../models/Model";
import ObjectHelpers from "../utils/object-helpers";

export class SnapshotData {
    data: {[k: string]: Array<DeepPartial<Model>>};

    constructor() {
        this.data = {};
    }

    public hasItem(entity: Function, data: DeepPartial<Model>): boolean {
        const entityName: string = entity.constructor.name;

        if (!this.data[entityName] || !Array.isArray(this.data[entityName])) {
            return false;
        }

        const matches = this.data[entityName].filter((item: DeepPartial<Model>) => {
            return ObjectHelpers.contains(item, data);
        });

        return matches.length > 0;
    }

    
    public addItem(entity: typeof Model, data: DeepPartial<Model>) {
        const entityName: string = entity.name;

        if (!this.data[entityName]) {
            this.data[entityName] = [];
        }

        this.data[entityName].push(data);
    }

    merge(other: SnapshotData): SnapshotData {
        for(let entity in other.data) {
            for(let i = 0; i < other.data[entity].length; i++) {
                if (!this.data[entity]) {
                    this.data[entity] = [];
                } 
                
                if(this.data[entity].indexOf(other.data[entity][i]) < 0) {
                    this.data[entity].push(other.data[entity][i]);
                }
            }
        }

        return this;
    }
}