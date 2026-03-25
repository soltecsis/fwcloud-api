/*!
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

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import path from 'path';
import { In, Repository } from 'typeorm';
import sinon from 'sinon';
import * as fse from 'fs-extra';

import { describeName, expect, playgroundPath, testSuite } from '../../../mocha/global-setup';
import { AuditLogService } from '../../../../src/models/audit/AuditLog.service';
import { AuditLog } from '../../../../src/models/audit/AuditLog';
import db from '../../../../src/database/database-manager';
import { Zip } from '../../../../src/utils/zip';

describe(describeName('AuditLogService archive Unit tests'), () => {
  let service: AuditLogService;
  let dataDir: string;
  let repo: Repository<AuditLog>;

  const resolveArchiveDir = (): string => {
    const configuredDir: string = testSuite.app.config.get('auditLogs.archive.data_dir');
    return path.isAbsolute(configuredDir)
      ? configuredDir
      : path.resolve(testSuite.app.path, configuredDir);
  };

  const createAuditLog = async (overrides: Partial<AuditLog>): Promise<AuditLog> => {
    const entity = repo.create(
      Object.assign(
        {
          call: 'test-call',
          data: JSON.stringify({ payload: true }),
          description: 'test-description',
          timestamp: new Date(),
        },
        overrides,
      ),
    );

    return repo.save(entity);
  };

  const findArchiveZip = async (): Promise<string | null> => {
    const years = await fse.readdir(dataDir);

    for (const year of years) {
      const months = await fse.readdir(path.join(dataDir, year));

      for (const month of months) {
        const files = await fse.readdir(path.join(dataDir, year, month));
        const zip = files.find((file) => file.endsWith('.sql.zip'));
        if (zip) {
          return path.join(dataDir, year, month, zip);
        }
      }
    }

    return null;
  };

  beforeEach(async () => {
    service = await testSuite.app.getService<AuditLogService>(AuditLogService.name);
    dataDir = resolveArchiveDir();

    repo = db.getSource().manager.getRepository(AuditLog);
    await repo.createQueryBuilder().delete().execute();

    await fse.remove(dataDir);
    await fse.mkdirp(dataDir);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns zero when there are no entries to archive', async () => {
    const result = await service.archiveHistory();

    expect(result).to.equal(0);

    const contents = await fse.readdir(dataDir);
    expect(contents).to.have.length(0);
  });

  it('archives expired audit log entries into a zipped SQL file', async () => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - 200);

    const [expiredOne, expiredTwo] = await repo.save([
      repo.create({
        call: 'call-1',
        data: JSON.stringify({ entry: 1 }),
        description: 'first expired entry',
        timestamp: expirationDate,
      }),
      repo.create({
        call: 'call-2',
        data: JSON.stringify({ entry: 2 }),
        description: 'second expired entry',
        timestamp: expirationDate,
      }),
    ]);

    const freshEntry = await createAuditLog({
      call: 'call-fresh',
      data: JSON.stringify({ entry: 'fresh' }),
      description: 'fresh entry',
      timestamp: new Date(),
    });

    const archivedRows = await service.archiveHistory();

    expect(archivedRows).to.equal(2);

    const remainingExpired = await repo.count({
      where: { id: In([expiredOne.id, expiredTwo.id]) },
    });
    expect(remainingExpired).to.equal(0);

    const remainingFresh = await repo.findOne({ where: { id: freshEntry.id } });
    expect(remainingFresh).to.not.be.null;

    const zipPath = await findArchiveZip();
    expect(zipPath).to.not.be.null;
    const resolvedZipPath = zipPath as string;

    const unzipDestination = path.join(playgroundPath, 'auditlog-archive');
    await fse.mkdirp(unzipDestination);
    await Zip.unzip(resolvedZipPath, unzipDestination);

    const sqlFileName = path.basename(resolvedZipPath).replace('.zip', '');
    const sqlContent = await fse.readFile(path.join(unzipDestination, sqlFileName), 'utf8');

    expect(sqlContent).to.contain('INSERT INTO `audit_logs`');
    expect(sqlContent).to.contain("'call-1'");
    expect(sqlContent).to.contain("'call-2'");

    await fse.remove(unzipDestination);
  });

  it('removes archived files that exceed the retention period', async () => {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() - 200);

    await repo.save([
      repo.create({
        call: 'call-old',
        data: JSON.stringify({ entry: 'old' }),
        description: 'old entry',
        timestamp: expirationDate,
      }),
    ]);

    await service.archiveHistory();

    const zipPath = await findArchiveZip();
    expect(zipPath).to.not.be.null;
    const resolvedZipPath = zipPath as string;

    const retentionDays = service.getCustomizedConfig().retention_days;
    const outdatedDate = new Date();
    outdatedDate.setDate(outdatedDate.getDate() - (retentionDays + 1));

    sinon
      .stub(
        service as unknown as { getDateFromArchiveFilename: () => Date },
        'getDateFromArchiveFilename',
      )
      .callsFake(() => outdatedDate);

    const removedFiles = await service.removeExpiredFiles();

    expect(removedFiles).to.equal(1);
    expect(await fse.pathExists(resolvedZipPath)).to.be.false;
  });
});
