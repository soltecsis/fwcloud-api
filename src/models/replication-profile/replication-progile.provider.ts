import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { AbstractApplication } from '../../fonaments/abstract-application';
import { ReplicationProfileService } from './replication-profile.service';

export class ReplicationProfileServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      ReplicationProfileService.name,
      (app: AbstractApplication) => {
        return ReplicationProfileService.make(app);
      },
    );
  }
}
