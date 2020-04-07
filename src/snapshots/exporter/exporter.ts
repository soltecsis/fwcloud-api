import { Connection } from "typeorm";
import { DatabaseService } from "../../database/database.service";
import { app } from "../../fonaments/abstract-application";
import { FwCloudExporter } from "./fwcloud-exporter";
import { TableExporter, TableExporterResults } from "./table-exporter";
import ObjectHelpers from "../../utils/object-helpers";
import { FirewallExporter } from "./firewall.exporter";
import { CaExporter } from "./ca.exporter";
import { CaPrefixExporter } from "./ca-prefix.exporter";
import { ClusterExporter } from "./cluster.exporter";
import { CrtExporter } from "./crt.exporter";
import { InterfaceExporter } from "./interface.exporter";
import { IPObjExporter } from "./ipobj.exporter";
import { IPObjToIPObjGroupExporter } from "./ipobj-to-ipobj-group.exporter";
import { IPObjGroupExporter } from "./ipobj-group.exporter";
import { MarkExporter } from "./mark.exporter";
import { OpenVPNExporter } from "./openvpn.exporter";
import { OpenVPNOptionsExporter } from "./openvpn-options.exporter";
import { OpenVPNPrefixExporter } from "./openvpn-prefix.exporter";
import { PolicyGroupExporter } from "./policy-group.exporter";
import { PolicyRuleExporter } from "./policy-rule.exporter";
import { InterfaceToIPObjExporter } from "./interface-to-ipobj.exporter";
import { PolicyRuleToInterfaceExporter } from "./policy-rule-to-interface.exporter";
import { PolicyRuleToIPObjExporter } from "./policy-rule-to-ipobj.exporter";
import { PolicyRuleToOpenVPNExporter } from "./policy-rule-to-openvpn.exporter";
import { PolicyRuleToOpenVPNPrefixExporter } from "./policy-rule-to-openvpn-prefix.exporter";
import { OpenVPNToIPObjGroupExporter } from "./openvpn-to-ipobj-group.exporter";
import { OpenVPNPrefixToIPObjGroupExporter } from "./openvpn-prefix-to-ipobj-group.exporter";

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
    new OpenVPNToIPObjGroupExporter()
];

export class Exporter {
    protected _result: TableExporterResults;

    public async export(fwcloudId: number): Promise<TableExporterResults> {
        const databaseService: DatabaseService = await app().getService<DatabaseService>(DatabaseService.name);
        const connection: Connection = databaseService.connection;
        this._result = {};

        for(let i = 0; i < EXPORTERS.length; i++) {
            const exporter: TableExporter = EXPORTERS[i];
            const data = await exporter.export(connection, fwcloudId);
            this._result = <TableExporterResults>ObjectHelpers.merge(this._result, data);
        }


        return this._result;
    }
}