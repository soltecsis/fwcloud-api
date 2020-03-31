import { describeName, expect } from "../../mocha/global-setup";
import { ImportMapping } from "../../../src/snapshots/import-mapping";

let mapper: ImportMapping;

describe(describeName('Import mapping tests'), () => {
    beforeEach(() => {
        mapper = new ImportMapping();
    });

    it('newItem should add a id mapping', () => {
        const old_id: number = 0;
        const new_id: number = 1;

        mapper.newItem("FwCloud", {id: {old: 0, new: 1}});

        expect(mapper.maps).to.be.deep.eq({
            FwCloud: {
                id: [{old: 0, new: 1}]
            }
        })
    });

    it('newItem should overwrite if the id is already mapped', () => {
        mapper.newItem("FwCloud", {id: {old: 0, new: 1}});
        mapper.newItem("FwCloud", {id: {old: 0, new: 3}});

        expect(mapper.maps).to.be.deep.eq({
            FwCloud: {
                id: [{old: 0, new: 3}]
            }
        });
    });

    it('findItem should returns the mapped id', () => {
        mapper.newItem("FwCloud", {id: {old: 0, new: 3}});

        expect(mapper.findItem("FwCloud", "id", {old: 0}).new).to.be.deep.equal(3);
        expect(mapper.findItem("FwCloud", "id", {new: 3}).old).to.be.deep.equal(0);
    });
});