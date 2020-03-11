import { RepositoryService } from "../../database/repository.service";
import { app } from "../../fonaments/abstract-application";
import { DeepPartial } from "typeorm";
import Model from "../../models/Model";
import { ImportMapping } from "../import-mapping";

export class EntityImporter {
    protected constructor() {}

    public repositoryService: RepositoryService;
    
    public static async build<T extends EntityImporter>(): Promise<T> {
        const importer: T = <T>Reflect.construct(this, []);
        importer.repositoryService = await app().getService<RepositoryService>(RepositoryService.name);
        return importer;
    }

    public async import(data: DeepPartial<Model>, mapper: ImportMapping, ... context: Array<any>): Promise<void> {
        throw new Error("Method not implemented.");
    }
}