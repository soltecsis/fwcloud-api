import { ServiceProvider } from "../fonaments/services/service-provider";
import {
  ServiceContainer,
  ServiceBound,
} from "../fonaments/services/service-container";
import { LogService } from "./log.service";
import { AbstractApplication } from "../fonaments/abstract-application";

export class LogServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      LogService.name,
      (app: AbstractApplication) => {
        return LogService.make(app);
      },
    );
  }
}
