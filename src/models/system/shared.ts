import { SelectQueryBuilder } from "typeorm";
import { IPObj } from "../ipobj/IPObj";
import { IPObjGroup } from "../ipobj/IPObjGroup";

//TODO: Everything related to compilation is missing
export type AvailableDestinations = 'grid';

export type ItemForGrid = {
    entityId: number;
    id: number; // Item id.
    name: string;
    type: number;
    firewall_id: number;
    firewall_name: string;
    cluster_id: number;
    cluster_name: string;
    host_id?: number;
    host_name?: string;
};

export class DHCPUtils {
    public static async mapEntityData<T extends ItemForGrid>(sql: SelectQueryBuilder<IPObj|IPObjGroup>, ItemsArrayMap: Map<number, T[]>): Promise<void> {
        const data: T[] = await sql.getRawMany() as T[];

        for (let i=0; i<data.length; i++) {
            const items: T[] = ItemsArrayMap.get(data[i].entityId);
            items?.push(data[i]);
        }

        return;
    }
}