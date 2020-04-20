import { QueryRunner, getMetadataArgsStorage } from "typeorm";
import { ExporterResult, ExporterResultData, ExporterTableResult } from "../../exporter/exporter-result";
import { IdManager } from "./mapper/id-manager";
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

    constructor(queryRunner: QueryRunner) {
        this._queryRunner = queryRunner;
    }
    
    /**
     * For a given exporter result, terraform will map the current ids exported for non used ids in the current database
     * 
     * @param exportResults 
     */
    public async terraform(exportResults: ExporterResult): Promise<ExporterResult> {
        const idManager: IdManager = await IdManager.make(this._queryRunner, exportResults.getTableWithEntities())
        const mapper: ImportMapping = new ImportMapping(idManager, exportResults);
        const result: ExporterResult = new ExporterResult();

        const data: ExporterResultData = exportResults.getAll();
        
        for(let tableName in data) {
            const entityName: string = data[tableName].entity;
            const terraformer: TableTerraformer = await (await this.getTerraformer(tableName)).make(mapper, this._queryRunner);
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