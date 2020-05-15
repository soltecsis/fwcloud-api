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