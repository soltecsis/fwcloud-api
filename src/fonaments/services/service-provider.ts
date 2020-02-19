import { ServiceContainer } from "./service-container";
import { AbstractApplication } from "../abstract-application";

export interface IServiceProvider {
    register(serviceContainer: ServiceContainer): void;
}
export abstract class ServiceProvider implements IServiceProvider {
    protected app: AbstractApplication;

    constructor(app: AbstractApplication) {
        this.app = app;
    }

    public abstract async register(serviceContainer: ServiceContainer): Promise<void>;
}