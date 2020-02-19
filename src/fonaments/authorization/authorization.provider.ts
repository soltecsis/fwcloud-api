import { ServiceProvider } from "../services/service-provider";
import { ServiceContainer } from "../services/service-container";
import { AuthorizationService } from "./authorization.service";
import { AbstractApplication } from "../abstract-application";

export class AuthorizationServiceProvider extends ServiceProvider {
    public async register(serviceContainer: ServiceContainer): Promise<void> {
        serviceContainer.singleton(AuthorizationService.name, (app: AbstractApplication) => {
            return new AuthorizationService(app);
        });
    }

}