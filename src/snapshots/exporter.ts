import { EntityExporter } from "./exporters/entity-exporter"
import { FwCloudExporter } from "./exporters/fwcloud-exporter"

export class Exporter {
    _customExporters: {[k:string]: typeof EntityExporter} = {
        FwCloud: FwCloudExporter
    }

    buildExporterFor(propertyName: string): typeof EntityExporter {
        if (this._customExporters[propertyName]) {
            return this._customExporters[propertyName];
        }

        return EntityExporter;
    }
}