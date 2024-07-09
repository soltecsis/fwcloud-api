import { ServiceProvider } from '../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../fonaments/services/service-container';
import { AbstractApplication } from '../fonaments/abstract-application';
import { CaService } from './ca.service';

export class CaServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      CaService.name,
      async (app: AbstractApplication): Promise<CaService> => {
        return CaService.make(app);
      },
    );
  }
}
