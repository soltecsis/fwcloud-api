/*!
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Application } from "./Application";
import https from "https";
import http from "http";
import * as fs from "fs";
import io from "socket.io";
import { ConfigurationErrorException } from "./config/exceptions/configuration-error.exception";
import { logger } from "./fonaments/abstract-application";

export class Server {
  private _application: Application;
  private _config;
  private _server: https.Server | http.Server;

  constructor(app: Application) {
    this._application = app;
    this._config = app.config;
  }

  public async start(): Promise<any> {
    try {
      this.validateApplicationConfiguration();

      if (this._config.get("api_server").enabled) {
        this._server = this.isHttps()
          ? this.startHttpsServer()
          : this.startHttpServer();
        this.bootstrapEvents();
        await this.bootstrapSocketIO();
      } else logger().info("API server not started because it is not enabled.");
    } catch (error) {
      logger().error("ERROR CREATING HTTP/HTTPS SERVER: ", error);
      process.exit(1);
    }

    fs.writeFileSync(".pid", `${process.pid}`);

    return this;
  }

  private startHttpsServer(): https.Server {
    const tlsOptions: {
      key: string;
      cert: string;
      ca: string | null;
    } = {
      key: fs.readFileSync(this._config.get("api_server").key).toString(),
      cert: fs.readFileSync(this._config.get("api_server").cert).toString(),
      ca: this._config.get("api_server").ca_bundle
        ? fs.readFileSync(this._config.get("api_server").ca_bundle).toString()
        : null,
    };

    return https.createServer(tlsOptions, this._application.express);
  }

  private startHttpServer(): http.Server {
    return http.createServer(this._application.express);
  }

  private bootstrapEvents() {
    this._server.listen(
      this._config.get("api_server").port,
      this._config.get("api_server").ip,
    );

    this._server.on("error", (error: Error) => {
      throw error;
    });

    this._server.on("listening", () => {
      logger().info(`Listening on ${this.getFullURL()}`);

      // In prod mode, log messages are not shown in terminal. As a result, user doesn't know when application has started.
      // So, we print out the message directly
      if (this._config.get("env") === "prod") {
        console.log(`Listening on ${this.getFullURL()}`);
      }
    });
  }

  private async bootstrapSocketIO() {
    const _io: io.Server = new io.Server(this._server, {
      pingInterval: this._config.get("socket_io").pingInterval,
      pingTimeout: this._config.get("socket_io").pingTimeout,
    });
    await (<Application>this._application).setSocketIO(_io);
  }

  protected validateApplicationConfiguration() {
    if (!this._application.config.get("session").secret) {
      throw new ConfigurationErrorException(
        "Configuration Error: Session secret must be defined in .env",
      );
    }

    if (!this._application.config.get("db").pass) {
      throw new ConfigurationErrorException(
        "Configuration Error: Database password must be defined in .env",
      );
    }

    if (!this._application.config.get("crypt").secret) {
      throw new ConfigurationErrorException(
        "Configuration Error: Encryption secret must be defined in .env",
      );
    }

    if (process.env.CORS_WHITELIST) {
      this._application.config.set(
        "CORS.whitelist",
        process.env.CORS_WHITELIST.replace(/ +/g, "").split(","),
      );
    }
  }

  public isHttps(): boolean {
    return this._config.get("api_server").https as boolean;
  }

  protected getFullURL(): string {
    return (
      (this.isHttps() ? "https" : "http") +
      "://" +
      this._application.config.get("api_server").ip +
      ":" +
      this._application.config.get("api_server").port
    );
  }

  get server(): https.Server | http.Server {
    return this._server;
  }
}
