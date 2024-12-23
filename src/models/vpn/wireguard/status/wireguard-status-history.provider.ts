import { AbstractApplication } from '../../../../fonaments/abstract-application';
import { ServiceBound, ServiceContainer } from '../../../../fonaments/services/service-container';
import { ServiceProvider } from '../../../../fonaments/services/service-provider';
import { WireGuardStatusHistoryService } from './wireguard-status-history.service';

export class WireGuardStatusHistoryServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      WireGuardStatusHistoryService.name,
      (app: AbstractApplication) => {
        return WireGuardStatusHistoryService.make(app);
      },
    );
  }
}
