import Model from "../models/Model";

export class ImportMapping {
    
    maps: {[k: string]: {[k2: number]: number}} = {}

    public newItem(model: typeof Model, old_id: number, new_id: number): void {
        const propertyName: string = model.name;

        if (!this.maps[propertyName]) {
            this.maps[propertyName] = {};
        }

        this.maps[propertyName][old_id] = new_id;

        return;
    }

    public getItem(model: typeof Model, old_id: number): number {
        const propertyName: string = model.name;

        return this.maps[propertyName] && this.maps[propertyName][old_id] ? this.maps[propertyName][old_id] : null;
    }
}