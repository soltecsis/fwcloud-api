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

import { RouteCollection } from "../fonaments/http/router/route-collection";
import { BackupController } from "../controllers/backups/backup.controller";
import { BackupConfigController } from "../controllers/backups/backup-config.controller";
import { CreateBackupValidator } from "../validators/create-backup.validator";
import { UpdateBackupConfigValidator } from "../validators/update-backup-config.validator";
import { RouterParser } from "../fonaments/http/router/router-parser";
import { isAdmin } from "../gates/isAdmin";
import { VersionController } from "../controllers/version.controller";

export class Routes extends RouteCollection {

    public routes(router: RouterParser): void {

        //Admin routes
        router.gates([isAdmin], (router) => {

            router.prefix('/backups', (router: RouterParser) => {
                //Backups
                router.get('/', BackupController, 'index').name('backups.index');
                router.post('/', BackupController, 'create', CreateBackupValidator).name('backups.store');
                router.get('/:id(\\d+)', BackupController, 'show').name('backups.show');
                router.post('/:id(\\d+)/restore', BackupController, 'restore').name('backups.restore');
                router.delete('/:id(\\d+)', BackupController, 'delete').name('backups.delete');

                // Backups Config
                router.prefix('/config', (router: RouterParser) => {
                    router.put('/', BackupConfigController, 'update', UpdateBackupConfigValidator).name('backups.config.update');
                    router.get('/', BackupConfigController, 'show').name('backups.config.show');
                });
            });

            //Version
            router.get('/version', VersionController, 'show').name('version.show');
        });
    }
}