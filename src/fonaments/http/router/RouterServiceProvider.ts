import { ServiceProvider } from "../../services/ServiceProvider";
import { ServiceContainer } from "../../services/ServiceContainer";
import { RouterService } from "./RouterService";
import { AbstractApplication } from "../../AbstractApplication";

export class RouterServiceProvider extends ServiceProvider {
    
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(RouterService.name, (app: AbstractApplication) => {
            return new RouterService(app);
        });
    }
}