import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { AbstractApplication } from '../../fonaments/abstract-application';
import { FwCloudService } from './fwcloud.service';

export class FwCloudServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(FwCloudService.name, (app: AbstractApplication) => {
      return FwCloudService.make(app);
    });
  }
}
