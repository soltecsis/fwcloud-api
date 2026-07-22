import type { AbstractApplication } from '../../fonaments/abstract-application';
import type { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { FirewallProfileDraftStateService } from './firewall-profile-draft-state.service';

export class FirewallProfileDraftStateServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      FirewallProfileDraftStateService.name,
      (app: AbstractApplication) => FirewallProfileDraftStateService.make(app),
    );
  }
}
