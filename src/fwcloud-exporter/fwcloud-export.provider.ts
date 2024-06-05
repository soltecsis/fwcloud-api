import { ServiceProvider } from '../fonaments/services/service-provider';
import {
  ServiceContainer,
  ServiceBound,
} from '../fonaments/services/service-container';
import { FwCloudExportService } from './fwcloud-export.service';
import { AbstractApplication } from '../fonaments/abstract-application';

export class FwCloudExportServiceProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(
      FwCloudExportService.name,
      (app: AbstractApplication) => {
        return FwCloudExportService.make(app);
      },
    );
  }
}
