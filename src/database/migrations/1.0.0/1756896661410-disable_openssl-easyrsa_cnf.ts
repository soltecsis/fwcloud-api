/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { MigrationInterface, QueryRunner } from 'typeorm';
import * as fs from 'fs';
import * as path from 'path';

function findAndRenameRecursive(
  dir: string,
  filename: string,
  renameFn: (filePath: string) => void,
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findAndRenameRecursive(fullPath, filename, renameFn);
    } else if (entry.isFile() && entry.name === filename) {
      renameFn(fullPath);
    }
  }
}

export class DisableOpensslEasyrsaCnf1756896661410 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const baseDir = path.join(process.cwd(), 'DATA', 'pki');
    const filename = 'openssl-easyrsa.cnf';

    findAndRenameRecursive(baseDir, filename, (filePath) => {
      const disabledFilePath = filePath + '.DISABLED';
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, disabledFilePath);
      }
    });
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const baseDir = path.join(process.cwd(), 'DATA', 'pki');
    const disabledFilename = 'openssl-easyrsa.cnf.DISABLED';

    findAndRenameRecursive(baseDir, disabledFilename, (filePath) => {
      const originalFilePath = filePath.replace(/\.DISABLED$/, '');
      if (fs.existsSync(filePath)) {
        fs.renameSync(filePath, originalFilePath);
      }
    });
  }
}
