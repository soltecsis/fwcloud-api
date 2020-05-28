import { FileLogger, QueryRunner } from "typeorm";
import { logger } from "../fonaments/abstract-application";
import { LoggerOptions } from "typeorm/logger/LoggerOptions";

export class DatabaseLogger extends FileLogger {

    constructor(protected _options?: LoggerOptions) {
        super(_options);
    }
    /**
     * Logs query that is failed.
     */
    logQueryError(error: string, query: string, parameters?: any[], queryRunner?: QueryRunner): void {
        if (this._options === "all" || this._options === true || (Array.isArray(this._options) && this._options.indexOf("error") !== -1)) {
            const sql = query + (parameters && parameters.length ? " -- PARAMETERS: " + this.stringifyParams(parameters) : "");
            this.writeError([
                `[FAILED QUERY]: ${sql}`,
                `[QUERY ERROR]: ${error}`
            ]);
        }
    }

    protected write(strings: string|string[]) {
        strings = Array.isArray(strings) ? strings : [strings];
        
        for(let i = 0; i < strings.length; i++) {
            logger('query').debug(strings[i]);
        }
    }

    protected writeError(strings: string | string []) {
        strings = Array.isArray(strings) ? strings : [strings];
        
        for(let i = 0; i < strings.length; i++) {
            logger('query').debug(strings[i]);
            logger().error(strings[i]);
        }
    }

}