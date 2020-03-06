import { ServiceProvider } from "../fonaments/services/service-provider";
import { ServiceBound, ServiceContainer } from "../fonaments/services/service-container";
import { SnapshotService } from "./snapshot.service";
import { AbstractApplication } from "../fonaments/abstract-application";

export class SnapshotServiceProvider extends ServiceProvider {
    public register(serviceContainer: ServiceContainer): ServiceBound {
        return serviceContainer.singleton(SnapshotService.name, async (app: AbstractApplication) => {
            return await SnapshotService.make(app);
        });
    }

}