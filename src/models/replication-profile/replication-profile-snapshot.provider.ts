import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { AbstractApplication } from '../../fonaments/abstract-application';
import { ReplicationProfileSnapshotService } from './replication-profile-snapshot.service';

export class ReplicationProfileSnapshotServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      ReplicationProfileSnapshotService.name,
      (app: AbstractApplication) => {
        return ReplicationProfileSnapshotService.make(app);
      },
    );
  }
}
