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
import * as fs from 'fs';
const exec = require('child-process-promise').exec;

export class UpdateUpdaterService extends Service {
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