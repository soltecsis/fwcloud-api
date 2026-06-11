import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { AbstractApplication } from '../../fonaments/abstract-application';
import { PolicyReplicationService } from './policy-replication.service';

export class PolicyReplicationServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(PolicyReplicationService.name, (app: AbstractApplication) => {
      return PolicyReplicationService.make(app);
    });
  }
}
