import { EntityExporter } from "./exporters/entity-exporter"
import { IPObjExporter } from "./exporters/ipobj-exporter";
import { FwcTreeExporter } from "./exporters/fwc-tree-exporter";
import { IPObjGroupExporter } from "./exporters/ipobj-group-exporter";
import { UserExporter } from "./exporters/user-exporter";
import { IPObjTypeExporter } from "./exporters/ipobj-type-exporter";
import { PolicyPositionExporter } from "./exporters/policy-position-exporter";
import { PolicyTypeExporter } from "./exporters/policy-type-exporter";
import { RoutingPositionExporter } from "./exporters/routing-position-exporter";
import { PolicyCompilationExporter } from "./exporters/policy-compilation-exporter";

export class Exporter {
    _customExporters: {[k:string]: typeof EntityExporter} = {
        FwcTree: FwcTreeExporter,
        IPObj: IPObjExporter,
        IPObjGroup: IPObjGroupExporter,
        IPObjType: IPObjTypeExporter,
        PolicyCompilation: PolicyCompilationExporter,
        PolicyPosition: PolicyPositionExporter,
        PolicyType: PolicyTypeExporter,
        RoutingPosition: RoutingPositionExporter,
        User: UserExporter,
    }

    buildExporterFor(propertyName: string): typeof EntityExporter {
        if (this._customExporters[propertyName]) {
            return this._customExporters[propertyName];
        }

        return EntityExporter;
    }
}