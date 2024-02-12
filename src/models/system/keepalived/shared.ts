import { SelectQueryBuilder } from "typeorm";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";

export type AvailableDestinations = 'compiler'| 'keepalived_grid';

export type ItemForGrid = {
    entityId: number;
    id: number;
    name: string;
    type: number;
    firewall_id: number;
    firewall_name: string;
    cluster_id: number;
    cluster_name: string;
    host_id?: number;
    host_name?: string;
};
//TODO: Revisar
export type KeepalivedRuleItemForCompiler = {
    entityId: number;
    type: number;
    address: string;
    netmask: string;
    range_start: string;
    range_end: string;
};

export class KeepalivedUtils {
    public static async mapEntityData<T extends ItemForGrid | KeepalivedRuleItemForCompiler>(sql: SelectQueryBuilder<IPObj | IPObjGroup>, ItemsArrayMap: Map<number, T[]>): Promise<void> {
        const data: T[] = await sql.getRawMany() as T[];

        for (let i = 0; i < data.length; i++) {
            const items: T[] = ItemsArrayMap.get(data[i].entityId);
            items?.push(data[i]);
        }

        return;
    }
}