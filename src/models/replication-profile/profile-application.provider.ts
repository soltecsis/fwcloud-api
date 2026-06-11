import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { AbstractApplication } from '../../fonaments/abstract-application';
import { ProfileApplicationService } from './profile-application.service';

export class ProfileApplicationServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      ProfileApplicationService.name,
      (app: AbstractApplication) => {
        return ProfileApplicationService.make(app);
      },
    );
  }
}
