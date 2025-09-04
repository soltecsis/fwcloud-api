import { ServiceProvider } from '../../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../../fonaments/services/service-container';
import { AbstractApplication } from '../../../fonaments/abstract-application';
import { WireGuardPrefixService } from './wireguard-prefix.service';

export class WireGuardPrefixServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(WireGuardPrefixService.name, (app: AbstractApplication) => {
      return WireGuardPrefixService.make(app);
    });
  }
}
