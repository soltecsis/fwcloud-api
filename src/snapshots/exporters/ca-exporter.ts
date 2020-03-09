import { EntityExporter } from "./entity-exporter";
import { Ca } from "../../models/vpn/pki/Ca";
import { ExportResult } from "../export-result";

export class CaExporter extends EntityExporter {
    constructor(ca: Ca) {
        super();
        this.setInstance(ca);
    }

    public async export(): Promise<ExportResult> {
        const result = new ExportResult();
        result.cas.push(this.exportedEntity());
    
        return result;
    }
    
}