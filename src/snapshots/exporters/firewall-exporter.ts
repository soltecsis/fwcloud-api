import { EntityExporter } from "./entity-exporter";
import { ExportResult } from "../export-result";
import { Firewall } from "../../models/firewall/Firewall";

export class FirewallExporter extends EntityExporter {
    constructor(firewall: Firewall) {
        super();
        this.setInstance(firewall);
    }
    
    public async export(): Promise<ExportResult> {
        const result = new ExportResult();
        
        result.firewalls.push(this.exportedEntity());

        return result;
    }

}