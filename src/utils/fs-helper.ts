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

export class FSHelper {
    public static async directoryExists(path: fs.PathLike): Promise<boolean> {
        return new Promise<boolean>((resolve, reject) => {
            fs.stat(path, (error: Error, stats: fs.BigIntStats) => {
                if (error) {
                    return resolve(false);
                }

                return resolve(stats.isDirectory());
            });
        })
    }

    public static directoryExistsSync(path: fs.PathLike): boolean {
        try {
            const stat: fs.Stats = fs.statSync(path);
            
            if (!stat || !stat.isDirectory()) {
                throw new Error();
            }
        } catch {
            return false;
        }

        return true;
    }

    public static async mkdir(path: string): Promise<void> {
        return fse.mkdirp(path);
    }

    public static async mkdirSync(path: string): Promise<void> {
        return fse.mkdirpSync(path);
    }

    public static async rmDirectory(path: string): Promise<void> {
        return fse.remove(path);
    }

    public static async copyDirectory(source: string, destination: string): Promise<void> {
        return fse.copy(source, destination);
    }

    public static async moveDirectory(source: string, destination: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            FSHelper.copyDirectory(source, destination).then(() => {
                FSHelper.rmDirectory(source).then(() => {
                    return resolve();
                }).catch(e => reject(e));
            }).catch(e => reject(e));
        });
    }

    public static async copyDirectoryIfExists(source: string, destination: string): Promise<void> {
        if (await this.directoryExists(source)) {
            return await FSHelper.copyDirectory(source, destination);
        }
    }
}