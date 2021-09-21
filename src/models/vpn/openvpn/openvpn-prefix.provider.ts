import { ServiceProvider } from "../../../fonaments/services/service-provider";
import { ServiceContainer, ServiceBound } from "../../../fonaments/services/service-container";
import { AbstractApplication } from "../../../fonaments/abstract-application";
import { OpenVPNPrefixService } from "./openvpn-prefix.service";

export class OpenVPNPrefixServiceProvider extends ServiceProvider {
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(OpenVPNPrefixService.name, (app: AbstractApplication) => {
            return OpenVPNPrefixService.make(app);
        });
    }
}