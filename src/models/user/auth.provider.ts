import { AbstractApplication } from '../../fonaments/abstract-application';
import {
  ServiceBound,
  ServiceContainer,
} from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { AuthService } from './auth.service';

export class AuthServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      AuthServiceProvider.name,
      (app: AbstractApplication) => {
        return AuthService.make(app);
      },
    );
  }
}
