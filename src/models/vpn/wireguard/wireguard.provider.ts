import { ServiceProvider } from '../../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../../fonaments/services/service-container';
import { AbstractApplication } from '../../../fonaments/abstract-application';
import { WireGuardService } from './wireguard.service';

export class WireGuardServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(WireGuardService.name, (app: AbstractApplication) => {
      return WireGuardService.make(app);
    });
  }
}
