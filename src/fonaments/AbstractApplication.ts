import express from "express";
import * as fs from 'fs';

export abstract class AbstractApplication {
    protected _express: express.Application;
    protected _config: any;
    protected _path: string;
    protected _preMiddlewares: Array<any> = [];
    protected _postMiddlewares: Array<any> = [];

    constructor(path: string = process.cwd()) {
        try {
            this._path = path;
            console.log('Loading application from ' + this._path);
            this._express = express();
            this._config = require('./config/config');
        } catch(e) {
            console.error('Aplication startup failed: ' + e.message);
            process.exit(e);
        }
    }

    get express(): express.Application {
        return this._express;
    }

    get config(): any {
        return this._config;
    }

    protected async bootstrap() {
        await this.generateDirectories();
        await this.registerMiddlewares();
    }

    /**
     * Register all middlewares
     */
    protected async registerMiddlewares(): Promise<void> {
        this._preMiddlewares.forEach((middleware) => {
            (new middleware()).register(this);
        })
    }

    private async generateDirectories() {
        try {
            fs.mkdirSync('./logs');
          } catch (e) {
            if (e.code !== 'EEXIST') {
              console.error("Could not create the logs directory. ERROR: ", e);
              process.exit(1);
            }
          }
          
          /**
           * Create the data directories, just in case them aren't there.
           */
          try {
            fs.mkdirSync('./DATA');
            fs.mkdirSync(this._config.get('policy').data_dir);
            fs.mkdirSync(this._config.get('pki').data_dir);
          } catch (e) {
            if (e.code !== 'EEXIST') {
              console.error("Could not create the data directory. ERROR: ", e);
              process.exit(1);
            }
          }
    }
}