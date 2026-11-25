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

import * as fs from 'fs';
import * as path from 'path';

export class PathHelper {
  /**
   * Returns the directory name from a directory path
   *
   * @param directoryPath
   */
  public static directoryName(directoryPath: fs.PathLike): string {
    return directoryPath.toString().split(path.sep).pop();
  }

  public static dataPathSegment(value: string | number): string {
    const segment = typeof value === 'number' ? String(value) : value;
    if (
      typeof segment !== 'string' ||
      !/^[a-zA-Z0-9_.:-]+$/.test(segment) ||
      segment === '.' ||
      segment === '..'
    ) {
      throw new Error('Invalid data path segment');
    }

    return segment;
  }

  public static async dataDirectory(
    root: string,
    ...segments: (string | number)[]
  ): Promise<string> {
    const components = segments.map((segment) => PathHelper.dataPathSegment(segment));
    const absoluteRoot = path.resolve(root);
    let directory = absoluteRoot;

    for (const component of components) {
      directory = path.join(directory, component);
      const stat = await fs.promises.lstat(directory).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
        return undefined;
      });
      if (!stat) return path.join(absoluteRoot, ...components);
      if (!stat.isDirectory()) throw new Error('Invalid data directory');
    }

    return directory;
  }
}
