import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { FirewallService } from './firewall.service';
import { AbstractApplication } from '../../fonaments/abstract-application';

export class FirewallServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(FirewallService.name, (app: AbstractApplication) => {
      return FirewallService.make(app);
    });
  }
}
