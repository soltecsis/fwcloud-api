import type { AbstractApplication } from '../../fonaments/abstract-application';
import type { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { FirewallProfileDraftService } from './firewall-profile-draft.service';

export class FirewallProfileDraftServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      FirewallProfileDraftService.name,
      (app: AbstractApplication) => FirewallProfileDraftService.make(app),
    );
  }
}
