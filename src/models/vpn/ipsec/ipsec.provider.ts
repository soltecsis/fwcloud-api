import { ServiceProvider } from '../../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../../fonaments/services/service-container';
import { AbstractApplication } from '../../../fonaments/abstract-application';
import { IPSecService } from './ipsec.service';

export class IPSecServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(IPSecService.name, (app: AbstractApplication) => {
      return IPSecService.make(app);
    });
  }
}
