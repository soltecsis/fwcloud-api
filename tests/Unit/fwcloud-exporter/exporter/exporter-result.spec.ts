import { describeName, expect } from "../../../mocha/global-setup";
import { ExporterResult } from "../../../../src/fwcloud-exporter/exporter/exporter-result";
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";

describe(describeName('ExporterResult tests'), () => {
    it('getTableWithEntities() should return all table names with entities which has been exported', () => {
        const exportResult = new ExporterResult();
        exportResult.addTableData("table1", "FwCloud", []);
        exportResult.addTableData("table2", "Firewall", []);
        exportResult.addTableData("table3", null, []);

        expect(exportResult.getTableWithEntities()).to.be.deep.eq([
            {
                entityName: "FwCloud",
                tableName: "table1"
            }, {
                entityName: "Firewall",
                tableName: "table2"
            }, {
                entityName: null,
                tableName: "table3"
            }
        ]);
    })
})