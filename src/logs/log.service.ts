import { Service } from '../fonaments/services/service';
import { FSHelper } from '../utils/fs-helper';
import * as winston from 'winston';
import * as path from 'path';

export type LogServiceConfig = {
  level: string;
  directory: string;
  maxFiles: number;
  maxSize: number;
};

export type LoggerType = 'default' | 'query' | 'http';

export type Transport =
  | winston.transports.ConsoleTransportInstance
  | winston.transports.FileTransportInstance;
export type TransportCollection = { [name: string]: Transport };
export type TransportName = 'file' | 'console';

export class LogService extends Service {
  protected _config: LogServiceConfig;

  protected _loggers: Partial<{
    default: winston.Logger;
    http: winston.Logger;
    query: winston.Logger;
  }>;

  protected _transports: TransportCollection = {};

  public async build(): Promise<LogService> {
    return new Promise((resolve, reject) => {
      this._config = this._app.config.get('log');

      if (!FSHelper.directoryExistsSync(this._config.directory)) {
        FSHelper.mkdirSync(this._config.directory);
      }

      this._loggers = {
        default: winston.createLogger({
          level: this._config.level,
          levels: winston.config.npm.levels,
          transports: this.getDefaultTransports(),
        }),
        http: winston.createLogger({
          level: 'entry',
          levels: { entry: 0 },
          transports: this.getHttpTransports(),
        }),
        query: winston.createLogger({
          level: 'info',
          levels: winston.config.npm.levels,
          transports: this.getQueryTransports(),
        }),
      };

      resolve(this);
    });
  }

  public getLogger(type: LoggerType = 'default'): winston.Logger {
    return this._loggers[type];
  }

  protected getDefaultTransports(): Array<Transport> {
    const transports: Array<Transport> = [];

    transports.push(
      new winston.transports.File({
        filename: path.join(this._config.directory, 'app.log'),
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          winston.format.printf(
            (info) => `${info.timestamp}|${info.level.toUpperCase()}|${info.message}`,
          ),
        ),
        maxsize: this._config.maxSize,
        maxFiles: this._config.maxFiles,
        tailable: true,
      }),
    );

    if (this._app.config.get('log.stdout')) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({
              format: 'YYYY-MM-DD HH:mm:ss',
            }),
            winston.format.printf(
              (info) => `${info.timestamp}|${info.level.toUpperCase()}|${info.message}`,
            ),
          ),
        }),
      );
    }

    return transports;
  }

  protected getQueryTransports(): Array<Transport> {
    const transports: Array<Transport> = [];
    transports.push(
      new winston.transports.File({
        filename: path.join(this._config.directory, 'query.log'),
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          winston.format.align(),
          winston.format.printf((info) => `${info.timestamp}|${info.message}`),
        ),
        maxsize: this._config.maxSize,
        maxFiles: this._config.maxFiles,
        tailable: true,
      }),
    );

    if (this._app.config.get('log.stdout')) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.timestamp({
              format: 'YYYY-MM-DD HH:mm:ss',
            }),
            winston.format.printf((info) => `${info.timestamp}|${info.message}`),
          ),
        }),
      );
    }

    return transports;
  }

  protected getHttpTransports(): Array<Transport> {
    const transports: Array<Transport> = [];
    transports.push(
      new winston.transports.File({
        filename: path.join(this._config.directory, 'http.log'),
        format: winston.format.combine(
          winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss',
          }),
          winston.format.printf((info) => `${info.timestamp}|${info.message}`),
        ),
        maxsize: this._config.maxSize,
        maxFiles: this._config.maxFiles,
        tailable: true,
      }),
    );

    return transports;
  }
}
