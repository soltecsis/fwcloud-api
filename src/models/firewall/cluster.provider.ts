import { ServiceProvider } from '../../fonaments/services/service-provider';
import {
  ServiceContainer,
  ServiceBound,
} from '../../fonaments/services/service-container';
import { AbstractApplication } from '../../fonaments/abstract-application';
import { ClusterService } from './cluster.service';

export class ClusterServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      ClusterService.name,
      (app: AbstractApplication) => {
        return ClusterService.make(app);
      },
    );
  }
}
