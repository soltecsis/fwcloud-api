import { ServiceProvider } from "../fonaments/services/service-provider";
import { ServiceContainer, ServiceBound } from "../fonaments/services/service-container";
import { RepositoryService } from "./repository.service";
import { AbstractApplication } from "../fonaments/abstract-application";

export class RepositoryServiceProvider extends ServiceProvider {
    
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(RepositoryService.name, async (app: AbstractApplication): Promise<RepositoryService> => {
            return await RepositoryService.make(app);
        });
    }
}