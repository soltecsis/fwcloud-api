import { TableTerraformer, TerraformHandlerCollection } from "../table-terraformer";
import { ImportMapping } from "../mapper/import-mapping";
import { FwCloud } from "../../../../models/fwcloud/FwCloud";
import { QueryRunner } from "typeorm";

export class IpObjGroupTerraformer extends TableTerraformer {
    
    public static async make(mapper: ImportMapping, queryRunner: QueryRunner): Promise<IpObjGroupTerraformer> {
        const terraformer: IpObjGroupTerraformer = new IpObjGroupTerraformer(mapper);
        return terraformer;
    }
    
    /**
     * The 'fwCloudId' foreign key is missing thus, this handler
     * maps the value as it was a foreign key
     */
    protected getCustomHandlers(): TerraformHandlerCollection {
        const result = {};

        result['fwCloudId'] = (mapper: ImportMapping, row: object, value: number) => {
            return mapper.getMappedId(FwCloud._getTableName(), 'id', value);
        };

        return result;
    }
}