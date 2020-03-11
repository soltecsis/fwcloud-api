import { DeepPartial } from "typeorm";
import Model from "../models/Model";

export class SnapshotData {
    data: {[k: string]: Array<DeepPartial<Model>>};

    constructor() {
        this.data = {};
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