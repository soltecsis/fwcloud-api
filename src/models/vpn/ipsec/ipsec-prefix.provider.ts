import { ServiceProvider } from '../../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../../fonaments/services/service-container';
import { AbstractApplication } from '../../../fonaments/abstract-application';
import { IPSecPrefixService } from './ipsec-prefix.service';

export class IPSecPrefixServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(IPSecPrefixService.name, (app: AbstractApplication) => {
      return IPSecPrefixService.make(app);
    });
  }
}
