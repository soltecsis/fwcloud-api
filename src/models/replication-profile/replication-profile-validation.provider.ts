import { AbstractApplication } from '../../fonaments/abstract-application';
import { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ReplicationProfileValidationService } from './replication-profile-validation.service';

export class ReplicationProfileValidationServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      ReplicationProfileValidationService.name,
      (app: AbstractApplication) => {
        return ReplicationProfileValidationService.make(app);
      },
    );
  }
}
