import { FwCloud } from "../../models/fwcloud/FwCloud";
import { Ca } from "../../models/vpn/pki/Ca";
import { Cluster } from "cluster";
import { Firewall } from "../../models/firewall/Firewall";
import { DeepPartial } from "typeorm";
import { SnapshotData } from "../snapshot";

export class ExportResult implements SnapshotData{
    
    fwclouds: Array<DeepPartial<FwCloud>>;
    cas: Array<DeepPartial<Ca>>;
    clusters: Array<DeepPartial<Cluster>>;
    firewalls: Array<DeepPartial<Firewall>>;

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