import { ServiceProvider } from "../fonaments/services/service-provider";
import {
  ServiceContainer,
  ServiceBound,
} from "../fonaments/services/service-container";
import { AbstractApplication } from "../fonaments/abstract-application";
import { CrtService } from "./crt.service";

export class CrtServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      CrtService.name,
      async (app: AbstractApplication): Promise<CrtService> => {
        return CrtService.make(app);
      },
    );
  }
}
