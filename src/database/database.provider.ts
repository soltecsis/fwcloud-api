import { ServiceProvider } from "../fonaments/services/service-provider";
import { ServiceContainer } from "../fonaments/services/service-container";
import { DatabaseService } from "./database.service";
import { AbstractApplication } from "../fonaments/abstract-application";
import { Service } from "../fonaments/services/service";

export class DatabaseServiceProvider extends ServiceProvider {
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(DatabaseService.name, async (app: AbstractApplication): Promise<Service> => {
            const db: DatabaseService = new DatabaseService(app);
            return await db.start();
        }); 
    }
}