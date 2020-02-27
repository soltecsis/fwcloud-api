import { ServiceProvider } from "../fonaments/services/service-provider";
import { ServiceContainer, ServiceBound } from "../fonaments/services/service-container";
import { BackupService } from "./backup.service";
import { AbstractApplication } from "../fonaments/abstract-application";
import { Service } from "../fonaments/services/service";

export class BackupServiceProvider extends ServiceProvider {
    
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(BackupService.name, async(app: AbstractApplication): Promise<BackupService> => {
            return await BackupService.make(app);
        });
    }

}