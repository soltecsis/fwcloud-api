import { ServiceProvider } from "../fonaments/services/service-provider";
import { ServiceContainer } from "../fonaments/services/service-container";
import { BackupService } from "./backup.service";
import { AbstractApplication } from "../fonaments/abstract-application";
import { Service } from "../fonaments/services/service";

export class BackupServiceProvider extends ServiceProvider {
    
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(BackupService.name, async(app: AbstractApplication): Promise<Service> => {
            const service = new BackupService(app);
            return await service.make();
        });
    }

}