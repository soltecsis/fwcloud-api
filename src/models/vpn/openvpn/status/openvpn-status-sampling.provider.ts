import { AbstractApplication } from '../../../../fonaments/abstract-application';
import { ServiceBound, ServiceContainer } from '../../../../fonaments/services/service-container';
import { ServiceProvider } from '../../../../fonaments/services/service-provider';
import { OpenVPNStatusSamplingService } from './openvpn-status-sampling.service';

export class OpenVPNStatusSamplingServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      OpenVPNStatusSamplingService.name,
      (app: AbstractApplication) => {
        return OpenVPNStatusSamplingService.make(app);
      },
    );
  }
}
