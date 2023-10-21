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
import cmp from 'semver-compare';
const spawn = require('child-process-promise').spawn;

export interface Versions {
  current: string;
  last: string;
  needsUpdate: boolean;
}

export enum Apps {
  WEBSRV = 'websrv',
  UI = 'ui',
  API = 'api',
  UPDATER = 'updater'
}

export class UpdateService extends Service {
  public async proxyUpdate(request: Request): Promise<any> {
    const updaterURL = this._app.config.get('updater').url;

    /* ATENTION+: Only forward the cookie header to fwcloud-updater. 
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


  public async compareVersions(app: Apps): Promise<Versions | null> {
    let localJson: any = {};
    let remoteJson: any = {};

    const localPath = `${this._app.config.get(app).installDir}/package.json`;
    try {
      fs.accessSync(localPath, fs.constants.R_OK);
      localJson = JSON.parse(fs.readFileSync(localPath, 'utf8'));
    } catch(err) {
      logger().error(`Accessing file '${localPath}' :`,err);
      return null;      
    }

    let remoteURL = '';
    try {
      remoteURL = `${this._app.config.get(app).versionURL}/main/package.json`;
      remoteJson = await axios.get(remoteURL);
    } catch (err) { 
      logger().error(`Accessing url '${remoteURL}':`,err);
      return null;
    }

    if (!localJson || !localJson.version) {
      logger().error(`No local version found updating fwcloud-${app}`);      
      return null;
    }

    if (!remoteJson || !remoteJson.data || !remoteJson.data.version) {
      logger().error(`No remote version found updating fwcloud-${app}`);      
      return null;
    }

    const versions: Versions = {
      current: localJson.version,
      last: remoteJson.data.version,
      needsUpdate: cmp(remoteJson.data.version,localJson.version) === 1 ? true : false
    }

    return versions;    
  }

  
  public async runUpdate(): Promise<void> {
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

    try { 
      logger().info('Updating fwcloud-updater ...');
      await spawn('npm', ['run', 'update'], { cwd: installDir });
      logger().info('fwcloud-updater update finished. Starting it ...');
      const promise = spawn('npm', ['run','start:bg'], { cwd: installDir, detached: true, stdio: 'ignore' });
      promise.childProcess.unref();
      await promise;

      // Await a few seconds to make sure that fwcloud-updater service is available again.
      // This is necessary for avoid errors that can arise if we update FWCloud-Updater with other modules at the same
      // time. For example, if we update FWCloud-Updater first and then FWCloud-Websrv, if we don't wait, we will try to
      // communicate with FWCloud-Updater for make the FWCloud-Websrv update before the fwcloud-updater service 
      // is available.
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    catch(err) {
      logger().error(`Error during fwcloud-updater update procedure: ${err.message}`);
      throw new Error('Error during fwcloud-updater update procedure');
    }

    return;
  }
}