import { AbstractApplication } from '../../fonaments/abstract-application';
import { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { SharedRulesService } from './shared-rules.service';

export class SharedRulesServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      SharedRulesService.name,
      (app: AbstractApplication): Promise<SharedRulesService> => {
        return SharedRulesService.make(app);
      },
    );
  }
}
