import { TableExporter, TableExporterResults } from "./table-exporter";
import Model from "../../models/Model";
import { SelectQueryBuilder, Connection, QueryRunner } from "typeorm";
import { OpenVPN } from "../../models/vpn/openvpn/OpenVPN";
import { OpenVPNExporter } from "./openvpn.exporter";
import { IPObjGroup } from "../../models/ipobj/IPObjGroup";
import { IPObjGroupExporter } from "./ipobj-group.exporter";

export class OpenVPNToIPObjGroupExporter extends TableExporter {
    protected getEntity(): typeof Model {
        return null;
    }

    public getTableName(): string {
        return 'openvpn__ipobj_g';
    }

    protected async getRows(connection: Connection, fwCloudId: number): Promise<any> {
        const qr: QueryRunner = connection.createQueryRunner();
        
        const data = await qr.query(`SELECT * FROM ${this.getTableName()} 
        WHERE openvpn IN ${this.getOpenVPNIds(connection, fwCloudId)[0]}`, this.getOpenVPNIds(connection, fwCloudId)[1]);
    
        await qr.release();

        return data;
    }

    protected getOpenVPNIds(connection: Connection, fwCloudId: number): [string, Array<any>] {
        const subquery = connection.createQueryBuilder().subQuery().from(OpenVPN, 'openvpn').select('openvpn.id');
        return new OpenVPNExporter().getFilterBuilder(subquery, 'openvpn', fwCloudId).getQueryAndParameters();
    }
}