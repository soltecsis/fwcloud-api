import { ServiceProvider } from "../fonaments/services/service-provider";
import { ServiceContainer, ServiceBound } from "../fonaments/services/service-container";
import { DatabaseService } from "./database.service";
import { AbstractApplication } from "../fonaments/abstract-application";

export class DatabaseServiceProvider extends ServiceProvider {
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(DatabaseService.name, async (app: AbstractApplication): Promise<DatabaseService> => {
            return await DatabaseService.make(app);
        }); 
    }
}