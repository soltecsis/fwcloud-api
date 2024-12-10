import { ServiceProvider } from '../../fonaments/services/service-provider';
import { ServiceContainer, ServiceBound } from '../../fonaments/services/service-container';
import { AIassistantService } from './ai-assistant.service';
import { AbstractApplication } from '../../fonaments/abstract-application';

export class AIAssistantServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      AIAssistantServiceProvider.name,
      (app: AbstractApplication) => {
        return AIassistantService.make(app);
      },
    );
  }
}
