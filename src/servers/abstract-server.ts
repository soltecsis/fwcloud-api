import { AbstractApplication } from "../fonaments/abstract-application";
import { ConfigurationErrorException } from "../config/exceptions/configuration-error.exception";

export abstract class AbstractServer<T> {
    protected _application: AbstractApplication;
    protected _server: T;

    constructor(application: AbstractApplication) {
        this._application = application;
        this.validateApplicationConfiguration();
    }

    public async run(): Promise<T> {
        this._server = await this.runServer();
        await this.bindEvents();
        await this.webSocketServer();
        return this._server;
    }

    protected async abstract runServer(): Promise<T>;

    protected async abstract bindEvents(): Promise<void>;

    protected async abstract webSocketServer(): Promise<void>;

    protected abstract protocol(): string;

    protected validateApplicationConfiguration() {
        if (!this._application.config.get('session').secret) {
            throw new ConfigurationErrorException("Configuration Error: Session secret must be defined in .env");
        }

        if (!this._application.config.get('db').pass) {
            throw new ConfigurationErrorException("Configuration Error: Database password must be defined in .env");
        }

        if (!this._application.config.get('crypt').secret) {
            throw new ConfigurationErrorException("Configuration Error: Encryption secret must be defined in .env");
        }

        if (process.env.CORS_WHITELIST) {
            this._application.config.set('CORS.whitelist', process.env.CORS_WHITELIST.replace(/ +/g, '').split(','));
        }
    }

}