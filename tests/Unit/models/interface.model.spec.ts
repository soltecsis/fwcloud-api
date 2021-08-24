/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Interface } from "../../../src/models/interface/Interface";
import { expect } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(Interface.name, () => {
    let fwcloudProduct: FwCloudProduct;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
    });

    describe('searchInterfaceUsage', () => {
        describe('route', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await Interface.searchInterfaceUsage(fwcloudProduct.interfaces.get('firewall-interface1').id,  10, fwcloudProduct.fwcloud.id, null);
    
                expect(whereUsed.restrictions.InterfaceInRoute.map(route => route.interface_id)).to.contains(fwcloudProduct.interfaces.get('firewall-interface1').id);
            });

        });
    })
})