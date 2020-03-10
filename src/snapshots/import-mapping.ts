import { FwCloud } from "../models/fwcloud/FwCloud";
import Model from "../models/Model";
import { Ca } from "../models/vpn/pki/Ca";
import { CaPrefix } from "../models/vpn/pki/CaPrefix";
import { Cluster } from "../models/firewall/Cluster";
import { Firewall } from "../models/firewall/Firewall";

const MODEL_MAP: Array<{ property: string, model: typeof Model }> = [
    { property: 'fwclouds', model: FwCloud},
    { property: 'cas', model: Ca},
    { property: 'caprefixes', model: CaPrefix},
    { property: 'clusters', model: Cluster},
    { property: 'firewalls', model: Firewall}
]

export class ImportMapping {
    
    maps: {[k: string]: {[k2: number]: number}} = {
        'fwclouds': {},
        'cas': {},
        'caprefixes': {},
        'clusters': {},
        'firewalls': {}
    }

    public newItem(model: typeof Model, old_id: number, new_id: number): void {
        const propertyName: string = this.getModelPropertyName(model);

        this.maps[propertyName][old_id] = new_id;

        return;
    }

    public getItem(model: typeof Model, old_id: number): number {
        const propertyName: string = this.getModelPropertyName(model);

        return this.maps[propertyName] && this.maps[propertyName][old_id] ? this.maps[propertyName][old_id] : null;
    }

    protected getModelPropertyName(model: typeof Model): string {
        const matches = MODEL_MAP.filter((item) => {
            return item.model === model;
        })

        return matches.length > 0 ? matches[0].property: null;
    }
}