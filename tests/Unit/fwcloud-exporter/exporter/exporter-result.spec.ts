import { describeName, expect } from "../../../mocha/global-setup";
import { ExporterResults } from "../../../../src/fwcloud-exporter/exporter/exporter-results";

describe(describeName('ExporterResult tests'), () => {
    it('getTableNames() should return all table names which has been exported', () => {
        const exportResult = new ExporterResults();
        exportResult.addResults("table1", null, []);
        exportResult.addResults("table2", null, []);
        exportResult.addResults("table3", null, []);

        expect(exportResult.getTableWithEntities()).to.be.deep.eq([
            "table1", "table2", "table3"
        ]);
    })
})