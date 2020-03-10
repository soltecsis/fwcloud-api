import { EntityExporter } from "./entity-exporter";
import { Crt } from "../../models/vpn/pki/Crt";
import { ExportResult } from "./export-result";

export class CrtExporter extends EntityExporter {
    constructor(crt: Crt) {
        super();
        this.setInstance(crt);
    }

    public async export(): Promise<ExportResult> {
        return new ExportResult();
    }

    
}