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

import { describeName, expect, testSuite } from "../../mocha/global-setup";
import { Application } from "../../../src/Application";
import request = require("supertest");
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";
import { attachSession, createUser, generateSession } from "../../utils/utils";
import { User } from "../../../src/models/user/User";
import { EntityManager } from "typeorm";
import db from "../../../src/database/database-manager";

describe(describeName('InputValidation Middleware E2E test'), () => {
    let app: Application;
    let fwcProduct: FwCloudProduct;
    let adminUser: User;
    let session: string;
    let manager: EntityManager;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();
        app = testSuite.app;
        manager = db.getSource().manager;
        fwcProduct = await new FwCloudFactory().make();
        adminUser = await createUser({role: 1});
        session = generateSession(adminUser);
    });

    it('should remove _object from the validation error', async() => {
        app.config.set('confirmation_token', false);

        await request(app.express)
            .post("/firewall")
            .set('Cookie', [attachSession(session)])
            .send({
                fwcloud: fwcProduct.fwcloud.id
            })
            .expect(400)
            .expect((response) => {
                expect(response.body._object).to.be.undefined;
            });
    });
})