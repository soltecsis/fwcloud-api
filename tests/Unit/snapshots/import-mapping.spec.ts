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