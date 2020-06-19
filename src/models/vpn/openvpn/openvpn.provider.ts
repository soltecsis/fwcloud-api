import { ServiceProvider } from "../../../fonaments/services/service-provider";
import { ServiceContainer, ServiceBound } from "../../../fonaments/services/service-container";
import { AbstractApplication } from "../../../fonaments/abstract-application";
import { OpenVPNService } from "./openvpn.service";

export class OpenVPNServiceProvider extends ServiceProvider {
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(OpenVPNService.name, (app: AbstractApplication) => {
            return OpenVPNService.make(app);
        });
    }
}