import { Service } from "./service";
import { AbstractApplication } from "../abstract-application";

export interface ServiceBound {
    singleton: boolean,
    name: string,
    target: CallableFunction,
    instance: Service
}

export class ServiceContainer {

    protected app: AbstractApplication;

    protected _services: Array<ServiceBound>;

    constructor(app: AbstractApplication) {
        this.app = app;
        this._services = [];
    }

    get services(): Array<ServiceBound> {
        return this._services;
    }

    public bind(name: string, target: (app: AbstractApplication) => Service): Promise<void> {
        if (this.isBound(name)) {
            throw new Error('Service ' + name + 'has been already bound');
        }

        this._services.push({
            singleton: false,
            name: name,
            target: target,
            instance: null
        });

        return;
    }

    public async singleton(name: string, target: (app: AbstractApplication) => Service): Promise<void> {
        this._services.push({
            singleton: true,
            name: name,
            target: target,
            instance: target(this.app)
        });
    }

    public isBound(name: string): boolean {
        return this.find(name) !== null;
    }

    public get(name: string): any {
        if (this.isBound(name)) {
            const service = this.find(name);
            const target = service.target

            if (service.singleton && service.instance === null) {
                service.instance = service.target(this.app);
            }

            if (service.singleton && service.instance !== null) {
                return service.instance;
            }

            return service.target(this.app);
        }

        return null;
    }

    private find(name: string): ServiceBound {
        const results: Array<ServiceBound> = this._services.filter((service: ServiceBound) => {
            return service.name === name;
        });

        return results.length > 0 ? results[0] : null;
    }
}