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

import { logger } from "../fonaments/abstract-application";
import { Service } from "../fonaments/services/service";
import { Request } from "express";
import * as fs from 'fs';
import axios, { AxiosRequestConfig, Method } from "axios";
import * as https from 'https';
const exec = require('child-process-promise').exec;

export class UpdateService extends Service {
  public async proxyUpdate(request: Request): Promise<any> {
    const updaterURL = this._app.config.get('updater').url;

    /* ATENTION: Only forward the cookie header to fwcloud-updater. 
    If all headers are forwarded with:
      headers: req.headers
    then the update request like PUT /updates/ui doesn't go.
    Updater recevies them, but don't arrive neither to the middleware
    nor the controller.
    Curiously, the GET /updates requests is processed correctly
    with al headres forwarded. */
    const req: AxiosRequestConfig = {
      method: <Method>request.method.toLowerCase(),
      url: `${updaterURL}${request.url}`,
      headers: { cookie: request.headers.cookie },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false
      })
    }

    try { 
      const res = await axios(req);
      return (res && res.data) ? res.data : null;
    }
    catch(err) {
      logger().error(`Proxying update request: ${err.message}`);
      throw new Error('Proxying update request');
    }
  }

  public async runUpdate(): Promise<void> {
    logger().info(`Updating fwcloud-updater`);

    const installDir = this._app.config.get('updater').installDir;

    // Make sure install dir exists.
    try { fs.lstatSync(installDir).isDirectory() }
    catch (err) { 
      logger().error(`Directory not found: ${installDir}`);
      throw new Error('fwcloud-updater install directory not found');
    }

    try { fs.readdirSync(installDir) }
    catch (err) { 
      logger().error(`Accessing directory: ${installDir}`);
      throw new Error('fwcloud-updater install directory not accessible');
    }

    try { await exec(`cd ${installDir} && npm run update`) }
    catch(err) {
      logger().error(`Error during fwcloud-updater update procedure: ${err.message}`);
      throw new Error('Error during fwcloud-updater update procedure');
    }

    return;
  }
}