import { ServiceProvider } from '../fonaments/services/service-provider';
import {
  ServiceContainer,
  ServiceBound,
} from '../fonaments/services/service-container';
import { WebSocketService } from './web-socket.service';
import { AbstractApplication } from '../fonaments/abstract-application';

export class WebSocketServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      WebSocketService.name,
      async (app: AbstractApplication): Promise<WebSocketService> => {
        return WebSocketService.make(app);
      },
    );
  }
}
