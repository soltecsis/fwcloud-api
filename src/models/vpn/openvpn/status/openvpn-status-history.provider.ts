import { AbstractApplication } from '../../../../fonaments/abstract-application';
import {
  ServiceBound,
  ServiceContainer,
} from '../../../../fonaments/services/service-container';
import { ServiceProvider } from '../../../../fonaments/services/service-provider';
import { OpenVPNStatusHistoryService } from './openvpn-status-history.service';

export class OpenVPNStatusHistoryServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      OpenVPNStatusHistoryService.name,
      (app: AbstractApplication) => {
        return OpenVPNStatusHistoryService.make(app);
      },
    );
  }
}
