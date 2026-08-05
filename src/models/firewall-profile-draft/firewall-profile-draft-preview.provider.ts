import type { AbstractApplication } from '../../fonaments/abstract-application';
import type { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { FirewallProfileDraftPreviewService } from './firewall-profile-draft-preview.service';

export class FirewallProfileDraftPreviewServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      FirewallProfileDraftPreviewService.name,
      (app: AbstractApplication) => FirewallProfileDraftPreviewService.make(app),
    );
  }
}
