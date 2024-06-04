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

import * as fs from "fs";
import * as fse from "fs-extra";
import * as path from "path";

export class FSHelper {
  public static async directoryExists(
    directoryPath: fs.PathLike,
  ): Promise<boolean> {
    return new Promise<boolean>((resolve, reject) => {
      fs.stat(directoryPath, (error: Error, stats: fs.Stats) => {
        if (error) {
          return resolve(false);
        }

        return resolve(stats.isDirectory());
      });
    });
  }

  public static directoryExistsSync(directoryPath: fs.PathLike): boolean {
    try {
      const stat: fs.Stats = fs.statSync(directoryPath);

      if (!stat || !stat.isDirectory()) {
        throw new Error();
      }
    } catch (e) {
      return false;
    }

    return true;
  }

  public static fileExistsSync(filePath: fs.PathLike): boolean {
    try {
      const stat: fs.Stats = fs.statSync(filePath);

      if (!stat || !stat.isFile()) {
        throw new Error();
      }
    } catch (e) {
      return false;
    }

    return true;
  }

  public static async mkdir(directoryPath: string): Promise<void> {
    return fse.mkdirp(directoryPath);
  }

  public static async mkdirSync(directoryPath: string): Promise<void> {
    return fse.mkdirpSync(directoryPath);
  }

  public static remove(source: string): Promise<void> {
    return fse.remove(source);
  }

  public static async rmDirectory(directoryPath: string): Promise<void> {
    return fse.remove(directoryPath);
  }

  public static rmDirectorySync(directoryPath: string): void {
    return fse.removeSync(directoryPath);
  }

  public static async copy(source: string, destination: string): Promise<void> {
    return fse.copy(source, destination);
  }

  public static async moveDirectory(
    source: string,
    destination: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      FSHelper.copy(source, destination)
        .then(() => {
          FSHelper.rmDirectory(source)
            .then(() => {
              return resolve();
            })
            .catch((e) => reject(e));
        })
        .catch((e) => reject(e));
    });
  }

  public static async copyDirectoryIfExists(
    source: string,
    destination: string,
  ): Promise<void> {
    if (await this.directoryExists(source)) {
      return await FSHelper.copy(source, destination);
    }
  }

  public static directories(directory: string): Promise<Array<string>> {
    return new Promise<Array<string>>((resolve, reject) => {
      try {
        const directories: Array<string> = fs
          .readdirSync(directory, { withFileTypes: true })
          .filter((item) => item.isDirectory())
          .map((item) => path.join(directory, item.name));

        return resolve(directories);
      } catch (e) {
        return reject(e);
      }
    });
  }
}
