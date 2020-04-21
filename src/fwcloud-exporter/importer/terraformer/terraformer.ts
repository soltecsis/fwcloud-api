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
import { ExporterResult, ExporterResultData } from "../../exporter/exporter-result";
import { ImportMapping } from "./mapper/import-mapping";
import { TableTerraformer } from "./table-terraformer";
import { FwcTreeTerraformer } from "./table-terraformers/fwc-tree.terraformer";
import { IpObjGroupTerraformer } from "./table-terraformers/ipobj-group.terraformer";
import { PolicyRuleToIpObjTerraformer } from "./table-terraformers/policy-rule-to-ipobj.terraformer";

const TERRAFORMERS: {[tableName: string]: typeof TableTerraformer} = {
    'fwc_tree' : FwcTreeTerraformer,
    'ipboj_g' : IpObjGroupTerraformer,
    'policy_r__ipobj': PolicyRuleToIpObjTerraformer
}

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
            const entityName: string = data[tableName].entity;
            const terraformer: TableTerraformer = await (await this.getTerraformer(tableName)).make(this._mapper, this._queryRunner);
            const terraformedData: Array<object> = await terraformer.terraform(tableName, entityName, data[tableName].data);
            result.addTableData(tableName, entityName, terraformedData);
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