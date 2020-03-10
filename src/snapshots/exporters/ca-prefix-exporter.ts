import { EntityExporter } from "./entity-exporter";
import { CaPrefix } from "../../models/vpn/pki/CaPrefix";
import { ExportResult } from "./export-result";

export class CaPrefixExporter extends EntityExporter {
    constructor(caPrefix: CaPrefix) {
        super();
        this.setInstance(caPrefix);
    }

    public async export(): Promise<ExportResult> {
        return new ExportResult();
    }
    
}