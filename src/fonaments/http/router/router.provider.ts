import { ServiceProvider } from "../../services/service-provider";
import { ServiceContainer } from "../../services/service-container";
import { RouterService } from "./router.service";
import { AbstractApplication } from "../../abstract-application";

export class RouterServiceProvider extends ServiceProvider {
    
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(RouterService.name, (app: AbstractApplication) => {
            return new RouterService(app);
        });
    }
}