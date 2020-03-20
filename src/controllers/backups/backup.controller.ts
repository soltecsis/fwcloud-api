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
import { Request } from "express";
import { Progress } from "../../fonaments/http/progress/progress";
import { SocketManager } from "../../sockets/socket-manager";

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
    public async index(request: Request): Promise<ResponseBuilder> {
        //TODO: Authorization

        const backups: Array<Backup> = await this._backupService.getAll();

        return ResponseBuilder.buildResponse().status(200).body(backups);
    }

    public async show(request: Request): Promise<ResponseBuilder> {
        //TODO: Authorization

        const backup: Backup = await this._backupService.findOneOrDie(parseInt(request.params.backup));

        return ResponseBuilder.buildResponse().status(200).body(backup);
    }
    
    /**
     * Starts a backup
     * 
     * @param request 
     * @param response 
     */
    public async store(request: Request): Promise<ResponseBuilder> {
        const socket: SocketManager = SocketManager.init(request.session.socket_id)

        //TODO: Authorization
        const progress: Progress<Backup> = this._backupService.create(request.inputs.get('comment'))
            .on('start', (payload) => {
                socket.event(payload);
            })
            .on('event', (payload) => {
                socket.event(payload);
            })
            .on('end', async (payload) => {
                await this._backupService.applyRetentionPolicy();
                socket.end(payload);
            });

        return ResponseBuilder.buildResponse().status(201).socket(socket).body(progress.response);
    }

    /**
     * Restores a backup
     * 
     * @param request 
     * @param response 
     */
    public async restore(request: Request): Promise<ResponseBuilder> {
        const socket: SocketManager = SocketManager.init(request.body.socket_id)

        //TODO: Authorization
        const backup: Backup = await this._backupService.findOne(parseInt(request.params.backup));

        this._app.config.set('maintenance_mode', true);

        this._backupService.restore(backup)
            .on('start', (payload) => {
                socket.event(payload);
            })
            .on('event', (payload) => {
                socket.event(payload);
            })
            .on('end', async (payload) => {
                socket.end(payload);
                this._app.config.set('maintenance_mode', false);
            });;

        return ResponseBuilder.buildResponse().status(201).socket(socket).body(backup);
    }

    /**
     * Destroy a backup
     * 
     * @param request 
     * @param response 
     */
    public async destroy(request: Request): Promise<ResponseBuilder> {
        //TODO: Authorization

        const backup: Backup = await this._backupService.findOneOrDie(parseInt(request.params.backup));

        await this._backupService.destroy(backup);

        return ResponseBuilder.buildResponse().status(204);
    }
}