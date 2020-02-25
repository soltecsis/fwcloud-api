import { Controller } from "../../fonaments/http/controller";
import { BackupService } from "../../backups/backup.service";
import { app } from "../../fonaments/abstract-application";
import { Backup } from "../../backups/backup";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Request, Response } from "express";

export class BackupController extends Controller {
    protected _backupService: BackupService;

    async make() {
        this._backupService = await app().getService(BackupService.name);
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

        const backup: Backup = await this._backupService.findOne(parseInt(request.params.id));

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
        const backup: Backup = await this._backupService.create();

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