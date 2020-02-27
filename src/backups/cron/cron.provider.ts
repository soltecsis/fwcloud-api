import { ServiceProvider } from "../../fonaments/services/service-provider";
import { ServiceContainer, ServiceBound } from "../../fonaments/services/service-container";
import { CronService } from "./cron.service";
import { AbstractApplication } from "../../fonaments/abstract-application";

export class CronServiceProvider extends ServiceProvider {
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(CronService.name, async(app: AbstractApplication): Promise<CronService> => {
            return await CronService.make(app);
        });
    }

}