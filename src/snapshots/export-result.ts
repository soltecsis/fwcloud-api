import { FwCloud } from "../models/fwcloud/FwCloud";
import { Ca } from "../models/vpn/pki/Ca";
import { Cluster } from "cluster";
import { Firewall } from "../models/firewall/Firewall";

export class ExportResult {
    fwclouds: Array<Partial<FwCloud>>;
    cas: Array<Partial<Ca>>;
    clusters: Array<Partial<Cluster>>;
    firewalls: Array<Partial<Firewall>>;

    constructor() {
        this.fwclouds = [];
        this.cas = [];
        this.clusters = [];
        this.firewalls = [];
    }

    merge(other: ExportResult): ExportResult {
        for(let entity in other) {
            for(let i = 0; i < other[entity].length; i++) {
                if (this[entity].indexOf(other[entity][i]) < 0) {
                    this[entity].push(other[entity][i]);
                }
            }
        }

        return this;
    }
}