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

import { describeName, testSuite, expect } from "../../mocha/global-setup";
import { SnapshotData } from "../../../src/snapshots/snapshot-data";
import { RepositoryService } from "../../../src/database/repository.service";
import { Application } from "../../../src/Application";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { DeepPartial } from "typeorm";
import { Ca } from "../../../src/models/vpn/pki/Ca";

let app: Application;
let repositoryService: RepositoryService;

describe(describeName('Snapshot data tests'), () => {
    beforeEach(async() => {
        app = testSuite.app;
        repositoryService = await app.getService<RepositoryService>(RepositoryService.name);
    });
});