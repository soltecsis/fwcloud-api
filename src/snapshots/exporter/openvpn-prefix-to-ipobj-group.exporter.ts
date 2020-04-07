import { TableExporter, TableExporterResults } from "./table-exporter";
import Model from "../../models/Model";
import { Connection, QueryRunner } from "typeorm";
import { OpenVPNPrefix } from "../../models/vpn/openvpn/OpenVPNPrefix";
import { OpenVPNPrefixExporter } from "./openvpn-prefix.exporter";

export class OpenVPNPrefixToIPObjGroupExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return null;
    }

    public getTableName(): string {
        return 'openvpn_prefix__ipobj_g';
    }

    protected async getRows(connection: Connection, fwCloudId: number): Promise<any> {
        const qr: QueryRunner = connection.createQueryRunner();
        
        const data = await qr.query(`SELECT * FROM ${this.getTableName()} 
        WHERE prefix IN ${this.getOpenVPNPrefixIds(connection, fwCloudId)[0]}`, this.getOpenVPNPrefixIds(connection, fwCloudId)[1]);
    
        await qr.release();

        return data;
    }

    protected getOpenVPNPrefixIds(connection: Connection, fwCloudId: number): [string, Array<any>] {
        const subquery = connection.createQueryBuilder().subQuery().from(OpenVPNPrefix, 'openvpn_prefix').select('openvpn_prefix.id');
        return new OpenVPNPrefixExporter().getFilterBuilder(subquery, 'openvpn_prefix', fwCloudId).getQueryAndParameters();
    }
}