import { TableTerraformer, TerraformHandlerCollection } from "../table-terraformer";
import { ImportMapping } from "../mapper/import-mapping";
import { Interface } from "../../../../models/interface/Interface";
import { IPObj } from "../../../../models/ipobj/IPObj";
import { IPObjGroup } from "../../../../models/ipobj/IPObjGroup";
import { QueryRunner } from "typeorm";

export class PolicyRuleToIpObjTerraformer extends TableTerraformer {
    
    public static async make(mapper: ImportMapping, queryRunner: QueryRunner): Promise<PolicyRuleToIpObjTerraformer> {
        const terraformer: PolicyRuleToIpObjTerraformer = new PolicyRuleToIpObjTerraformer(mapper);
        return terraformer;
    }
    
    /**
     * The following attributes should be a foreign keys but they are missing thus, this handler
     * maps the value as it was a foreign key
     */
    protected getCustomHandlers(): TerraformHandlerCollection {
        const result = {};

        result['interfaceId'] = (mapper: ImportMapping, row: object, value: number) => {
            return mapper.getMappedId(Interface._getTableName(), 'id', value);
        };

        result['ipObjId'] = (mapper: ImportMapping, row: object, value: number) => {
            return mapper.getMappedId(IPObj._getTableName(), 'id', value);
        };

        result['ipObjGroupId'] = (mapper: ImportMapping, row: object, value: number) => {
            return mapper.getMappedId(IPObjGroup._getTableName(), 'id', value);
        };

        return result;
    }
}