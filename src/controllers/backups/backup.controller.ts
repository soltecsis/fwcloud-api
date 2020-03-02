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
import { app } from "../../fonaments/abstract-application";
import { Backup } from "../../backups/backup";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Request, Response } from "express";
import { Authorized } from "../../fonaments/authorization/policy";
import { SpawnServiceException } from "../../fonaments/exceptions/service-container/spawn-service-exception";

export class BackupController extends Controller {
    protected _backupService: BackupService;

    async make() {
        this._backupService = await app().getService<BackupService>(BackupService.name);
    }

    /**
     * Returns all backups
     * 
     * @param request 
     * @param response 
     */
    public async index(request: Request, response: Response) {
        //TODO: Authorization

        const backups: Array<Backup> = await this._backupService.getAll();

        ResponseBuilder.make(response).status(200).send(backups);
    }

    public async show(request: Request, response: Response) {
        //TODO: Authorization

        const backup: Backup = await this._backupService.findOneOrDie(parseInt(request.params.id));

        ResponseBuilder.make(response).status(200).send(backup);
    }
    
    /**
     * Starts a backup
     * 
     * @param request 
     * @param response 
     */
    public async create(request: Request, response: Response) {
        //TODO: Authorization
        const backup: Backup = await this._backupService.create(request.inputs.get('comment'));

        ResponseBuilder.make(response).status(201).send(backup);
    }

    /**
     * Restores a backup
     * 
     * @param request 
     * @param response 
     */
    public async restore(request: Request, response: Response) {
        //TODO: Authorization
        const backup: Backup = await this._backupService.findOne(parseInt(request.params.id));

        await this._backupService.restore(backup);

        ResponseBuilder.make(response).status(201).send(backup);
    }

    /**
     * Destroy a backup
     * 
     * @param request 
     * @param response 
     */
    public async delete(request: Request, response: Response) {
        //TODO: Authorization

        const backup: Backup = await this._backupService.findOne(parseInt(request.params.id));

        await this._backupService.delete(backup);

        ResponseBuilder.make(response).status(200).send(backup);
    }
}