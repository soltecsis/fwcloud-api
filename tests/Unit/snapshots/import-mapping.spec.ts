import { describeName, expect } from "../../mocha/global-setup";
import { ImportMapping } from "../../../src/snapshots/import-mapping";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";

let mapper: ImportMapping;

describe(describeName('Import mapping tests'), () => {
    beforeEach(() => {
        mapper = new ImportMapping();
    });

    it('newItem should add a id mapping', () => {
        const old_id: number = 0;
        const new_id: number = 1;

        mapper.newItem(FwCloud, old_id, new_id);

        expect(mapper.maps).to.be.deep.eq({
            FwCloud: {
                0: 1
            }
        })
    });

    it('newItem should overwrite mapped ids', () => {
        mapper.newItem(FwCloud, 0, 1);
        mapper.newItem(FwCloud, 0, 2);

        expect(mapper.maps).to.be.deep.eq({
            FwCloud: {
                0: 2
            }
        });
    });

    it ('getItem should returns the mapped id', () => {
        mapper.newItem(FwCloud, 0, 2);

        expect(mapper.getItem(FwCloud, 0)).to.be.deep.eq(2);
    })
});