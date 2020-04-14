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

import { Connection } from "typeorm";
import { DatabaseService } from "../../database/database.service";
import { app } from "../../fonaments/abstract-application";
import { FwCloudExporter } from "./exporters/fwcloud.exporter";
import { TableExporter } from "./exporters/table-exporter";
import { FirewallExporter } from "./exporters/firewall.exporter";
import { CaExporter } from "./exporters/ca.exporter";
import { CaPrefixExporter } from "./exporters/ca-prefix.exporter";
import { ClusterExporter } from "./exporters/cluster.exporter";
import { CrtExporter } from "./exporters/crt.exporter";
import { InterfaceExporter } from "./exporters/interface.exporter";
import { IPObjExporter } from "./exporters/ipobj.exporter";
import { IPObjToIPObjGroupExporter } from "./exporters/ipobj-to-ipobj-group.exporter";
import { IPObjGroupExporter } from "./exporters/ipobj-group.exporter";
import { MarkExporter } from "./exporters/mark.exporter";
import { OpenVPNExporter } from "./exporters/openvpn.exporter";
import { OpenVPNOptionsExporter } from "./exporters/openvpn-options.exporter";
import { OpenVPNPrefixExporter } from "./exporters/openvpn-prefix.exporter";
import { PolicyGroupExporter } from "./exporters/policy-group.exporter";
import { PolicyRuleExporter } from "./exporters/policy-rule.exporter";
import { InterfaceToIPObjExporter } from "./exporters/interface-to-ipobj.exporter";
import { PolicyRuleToInterfaceExporter } from "./exporters/policy-rule-to-interface.exporter";
import { PolicyRuleToIPObjExporter } from "./exporters/policy-rule-to-ipobj.exporter";
import { PolicyRuleToOpenVPNExporter } from "./exporters/policy-rule-to-openvpn.exporter";
import { PolicyRuleToOpenVPNPrefixExporter } from "./exporters/policy-rule-to-openvpn-prefix.exporter";
import { OpenVPNToIPObjGroupExporter } from "./exporters/openvpn-to-ipobj-group.exporter";
import { OpenVPNPrefixToIPObjGroupExporter } from "./exporters/openvpn-prefix-to-ipobj-group.exporter";
import { FwcTreeExporter } from "./exporters/fwc-tree.exporter";
import { ExporterResults } from "./exporter-results";

const EXPORTERS = [
    new CaExporter(),
    new CaPrefixExporter(),
    new ClusterExporter(),
    new CrtExporter(),
    new FirewallExporter(),
    new FwCloudExporter(),
    new InterfaceToIPObjExporter(),
    new InterfaceExporter(),
    new IPObjGroupExporter(),
    new IPObjToIPObjGroupExporter(),
    new IPObjExporter(),
    new MarkExporter(),
    new OpenVPNOptionsExporter(),
    new OpenVPNPrefixExporter(),
    new OpenVPNExporter(),
    new OpenVPNPrefixToIPObjGroupExporter(),
    new PolicyGroupExporter(),
    new PolicyRuleToInterfaceExporter(),
    new PolicyRuleToIPObjExporter(),
    new PolicyRuleToOpenVPNPrefixExporter(),
    new PolicyRuleToOpenVPNExporter(),
    new PolicyRuleExporter(),
    new OpenVPNToIPObjGroupExporter(),
    new FwcTreeExporter()
];

export class Exporter {
    protected _result: ExporterResults;

    public async export(fwcloudId: number): Promise<ExporterResults> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        const connection: Connection = databaseService.connection;
        this._result = new ExporterResults();

        for(let i = 0; i < EXPORTERS.length; i++) {
            const exporter: TableExporter = EXPORTERS[i];
            await exporter.export(this._result, connection, fwcloudId);
        }


        return this._result;
    }
}