import { Service } from "../fonaments/services/service";
import { FSHelper } from "../utils/fs-helper";
import * as winston from "winston";
import * as path from "path";

export type LogServiceConfig = {
    directory: string
}

export type Transport = winston.transports.ConsoleTransportInstance | winston.transports.FileTransportInstance;
export type TransportCollection = { [name: string]: Transport }
export type TransportName = 'file' | 'console';


export class LogService extends Service {
    protected _config: LogServiceConfig;
    protected _logger: winston.Logger;

    protected _transports: TransportCollection = {};

    public async build(): Promise<LogService> {
        this._config = this._app.config.get('log');

        if (!FSHelper.directoryExistsSync(this._config.directory)) {
            FSHelper.mkdirSync(this._config.directory);
        }

        this._transports = {
            file: new winston.transports.File({
                filename: path.join(this._config.directory, 'fwcloud.log'),
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.align(),
                    winston.format.printf((info) => `[${info.timestamp}]${info.level.toUpperCase()}:${info.message}`)
                )
            }),
            console: new winston.transports.Console({
                format: winston.format.combine(
                    winston.format.timestamp(),
                    winston.format.align(),
                    winston.format.printf((info) => `[${info.timestamp}]${info.level.toUpperCase()}:${info.message}`)
                )
            })
        };

        this._logger = winston.createLogger({
            level: 'debug'
        });

        return this;
    }

    get logger(): winston.Logger {
        return this._logger;
    }

    public enableGeneralTransport(transport: TransportName) {
        this._logger.add(this._transports[transport]);
    }

    public disableGeneralTransport(transport: TransportName) {
        this._logger.remove(this._transports[transport]);
    }
}