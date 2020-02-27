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
import { RouterService } from "../fonaments/http/router/router.service";
import { BackupController } from "../controllers/backups/backup.controller";
import { BackupConfigController } from "../controllers/backups/backup-config.controller";
import { CreateBackupValidator } from "../validators/create-backup.validator";
import { UpdateBackupConfigValidator } from "../validators/update-backup-config.validator";

export class Routes extends RouteCollection {
    
    public routes(router: RouterService): void {
        
        //Backups
        router.get('/backups', BackupController, 'index');
        router.post('/backups', BackupController, 'create', CreateBackupValidator);
        router.get('/backups/:id(\\d+)', BackupController, 'show');
        router.post('/backups/:id(\\d+)/restore', BackupController, 'restore');
        router.delete('/backups/:id(\\d+)', BackupController, 'delete', );
        
        router.put('/backups/config', BackupConfigController, 'update', UpdateBackupConfigValidator);
        router.get('/backups/config', BackupConfigController, 'show');
    }
}