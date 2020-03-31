/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

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