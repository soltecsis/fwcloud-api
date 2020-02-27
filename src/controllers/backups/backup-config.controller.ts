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

import { Controller } from "../../fonaments/http/controller";
import { BackupService } from "../../backups/backup.service";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Request, Response } from "express";

export class BackupConfigController extends Controller {
    
    protected _backupService: BackupService;

    public async make(): Promise<void> {
        this._backupService = await this._app.getService<BackupService>(BackupService.name);
    }
    /**
     * Returns the backup config
     * 
     * @param request 
     * @param response 
     */
    public async show(request: Request, response: Response) {
        const config = this._backupService.config;

        ResponseBuilder.make(response).status(200).send(config);
    }

    /**
     * Updates the backup config
     * 
     * @param request 
     * @param response 
     */
    public async update(request: Request, response: Response) {
        await this._backupService.updateConfig(request.body);
        const config = this._backupService.config;

        ResponseBuilder.make(response).status(201).send(config);
    }
}