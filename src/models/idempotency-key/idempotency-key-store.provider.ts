import type { AbstractApplication } from '../../fonaments/abstract-application';
import type { ServiceBound, ServiceContainer } from '../../fonaments/services/service-container';
import { ServiceProvider } from '../../fonaments/services/service-provider';
import { IdempotencyKeyStore } from './idempotency-key-store.service';

export class IdempotencyKeyStoreProvider extends ServiceProvider {
  public register(serviceContainer: ServiceContainer): ServiceBound {
    return serviceContainer.singleton(IdempotencyKeyStore.name, (app: AbstractApplication) =>
      IdempotencyKeyStore.make(app),
    );
  }
}
