import { SelectQueryBuilder } from "typeorm";
import { IPObj } from "../../ipobj/IPObj";
import { IPObjGroup } from "../../ipobj/IPObjGroup";

export type AvailableDestinations = "regular_grid" | "fixed_grid" | "compiler";

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

export type DHCPRuleItemForCompiler = {
  entityId: number;
  type: number;
  address: string;
  netmask: string;
  range_start: string;
  range_end: string;
};

export class DHCPUtils {
  public static async mapEntityData<
    T extends ItemForGrid | DHCPRuleItemForCompiler,
  >(
    sql: SelectQueryBuilder<IPObj | IPObjGroup>,
    ItemsArrayMap: Map<number, T[]>,
  ): Promise<void> {
    const data: T[] = (await sql.getRawMany()) as T[];

    for (let i = 0; i < data.length; i++) {
      const items: T[] = ItemsArrayMap.get(data[i].entityId);
      items?.push(data[i]);
    }

    return;
  }
}
