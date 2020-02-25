import { ServiceProvider } from "../../fonaments/services/service-provider";
import { ServiceContainer } from "../../fonaments/services/service-container";
import { CronService } from "./cron.service";
import { AbstractApplication } from "../../fonaments/abstract-application";
import { ServiceInterface } from "../../fonaments/services/service";

export class CronServiceProvider extends ServiceProvider {
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(CronService.name, async(app: AbstractApplication): Promise<ServiceInterface> => {
            const service = new CronService(app);
            return await service.make();
        });
    }

}