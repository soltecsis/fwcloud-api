import { AbstractApplication } from '../../fonaments/abstract-application';
import { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { AIAssistantService } from './ai-assistant.service';

export class AIAssistantProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      AIAssistantService.name,
      async (app: AbstractApplication): Promise<AIAssistantService> => {
        return AIAssistantService.make(app);
      },
    );
  }

  public async bootstrap(app: AbstractApplication): Promise<void> {
    await app.getService<AIAssistantService>(AIAssistantService.name);
  }
}
