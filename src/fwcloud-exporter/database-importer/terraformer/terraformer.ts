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

import { QueryRunner } from "typeorm";
import { ExporterResult, ExporterResultData } from "../../database-exporter/exporter-result";
import { ImportMapping } from "./mapper/import-mapping";
import { TableTerraformer } from "./table-terraformer";
import { FwcTreeTerraformer } from "./table-terraformers/fwc-tree.terraformer";
import { IpObjGroupTerraformer } from "./table-terraformers/ipobj-group.terraformer";
import { PolicyRuleToIpObjTerraformer } from "./table-terraformers/policy-rule-to-ipobj.terraformer";
import { FwcTree } from "../../../models/tree/fwc-tree.model";
import { IPObjGroup } from "../../../models/ipobj/IPObjGroup";
import { PolicyRuleToIPObj } from "../../../models/policy/PolicyRuleToIPObj";
import { Firewall } from "../../../models/firewall/Firewall";
import { FirewallTerraformer } from "./table-terraformers/firewall.terraformer";

const TERRAFORMERS: {[tableName: string]: typeof TableTerraformer} = {};
TERRAFORMERS[FwcTree._getTableName()] = FwcTreeTerraformer;
TERRAFORMERS[IPObjGroup._getTableName()] = IpObjGroupTerraformer;
TERRAFORMERS[PolicyRuleToIPObj._getTableName()] = PolicyRuleToIpObjTerraformer;
TERRAFORMERS[Firewall._getTableName()] = FirewallTerraformer;

export class Terraformer {
    protected _queryRunner: QueryRunner;
    protected _mapper: ImportMapping;

    constructor(queryRunner: QueryRunner, mapper: ImportMapping) {
        this._queryRunner = queryRunner;
        this._mapper = mapper;
    }
    
    /**
     * For a given exporter result, terraform will map the current ids exported for non used ids in the current database
     * 
     * @param exportResults 
     */
    public async terraform(exportResults: ExporterResult): Promise<ExporterResult> {
        const result: ExporterResult = new ExporterResult();

        const data: ExporterResultData = exportResults.getAll();
        
        for(let tableName in data) {
            const terraformer: TableTerraformer = await (await this.getTerraformer(tableName)).make(this._mapper, this._queryRunner);
            const terraformedData: Array<object> = await terraformer.terraform(tableName, data[tableName]);
            result.addTableData(tableName, terraformedData);
        }

        return result;
    }

    protected async getTerraformer(tableName: string): Promise<typeof TableTerraformer> {
        if (TERRAFORMERS.hasOwnProperty(tableName)) {
            return TERRAFORMERS[tableName];
        }

        return TableTerraformer;
    }

    
}