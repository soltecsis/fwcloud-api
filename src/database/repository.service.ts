import { Service } from "../fonaments/services/service";
import { DatabaseService } from "./database.service";
import { getRepository, ObjectType, EntitySchema, Repository } from "typeorm";

export class RepositoryService extends Service {
    protected _databaseService: DatabaseService;

    public async build(): Promise<RepositoryService> {
        this._databaseService = await this._app.getService<DatabaseService>(DatabaseService.name);
        return this;
    }

    public for<Entity>(entityClass: ObjectType<Entity> | EntitySchema<Entity> | string, connectionName?: string): Repository<Entity> {
        return getRepository(entityClass, this._databaseService.connection.name);
    }
}