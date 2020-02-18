import { ServiceContainer } from "./ServiceContainer";
import { AbstractApplication } from "../AbstractApplication";

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