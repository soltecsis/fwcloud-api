/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Backup, backupDigestContent, BackupMetadata } from "../../../src/backups/backup";
import * as fs from "fs";
import * as path from "path";
import { DatabaseConfig, DatabaseService } from "../../../src/database/database.service";
import { expect, testSuite, describeName } from "../../mocha/global-setup";
import { BackupService } from "../../../src/backups/backup.service";
import { Application } from "../../../src/Application";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { QueryRunner, Migration } from "typeorm";
import { Firewall } from "../../../src/models/firewall/Firewall";
import moment from "moment";
import { FSHelper } from "../../../src/utils/fs-helper";
import sinon from "sinon";
import * as crypto from 'crypto';

let app: Application;
let service: BackupService;

describe(describeName('Backup Unit tests'), () => {

    before(async () => {
        app = testSuite.app;
        service = await app.getService<BackupService>(BackupService.name);
    });

    describe('exists()', () => {

        it('exists should return false if the backup is not persisted', async () => {
            const backup: Backup = new Backup();
            expect(backup.exists()).to.be.false;
        });
    });

    describe('create()', () => {

        it('should throw error exception if mysqldump command doesn\'t exists', async () => {
            let backup: Backup = new Backup();
            sinon.stub(backup, 'existsCmd').callsFake(cmd => { return Promise.resolve(false)});

            const t = () => {
                return backup.create(service.config.data_dir); 
            }

            await expect(t()).to.be.rejectedWith('Command mysqldump not found or it is not possible to execute it');
        });

        it('should create a backup directory', async () => {
            let backup: Backup = new Backup();
            await backup.create(service.config.data_dir);
            expect(backup.exists()).to.be.true;
            expect(backup.id).not.to.be.null;
            expect(fs.existsSync(backup.path)).to.be.true;
        });

        it('should create a dump data file', async () => {
            let backup: Backup = new Backup();
            backup = await backup.create(service.config.data_dir);
            expect(fs.existsSync(path.join(backup.path, Backup.DUMP_FILENAME))).to.be.true;
        });

        it('should copy pki data files if exists', async () => {
            let backup: Backup = new Backup();

            FSHelper.mkdirSync(path.join(app.config.get('pki').data_dir, 'test'));
            backup = await backup.create(service.config.data_dir);

            expect(FSHelper.directoryExistsSync(path.join(backup.path, Backup.DATA_DIRNAME, 'pki', 'test'))).to.be.true
        });

        it('should copy policy data files if exists', async () => {
            let backup: Backup = new Backup();

            FSHelper.mkdirSync(path.join(app.config.get('policy').data_dir, 'test'));
            backup = await backup.create(service.config.data_dir);

            expect(FSHelper.directoryExistsSync(path.join(backup.path, Backup.DATA_DIRNAME, 'policy', 'test'))).to.be.true
        });

        it('should copy snapshots data files if exists', async () => {
            let backup: Backup = new Backup();

            FSHelper.mkdirSync(path.join(app.config.get('snapshot').data_dir, 'test'));
            backup = await backup.create(service.config.data_dir);

            expect(FSHelper.directoryExistsSync(path.join(backup.path, Backup.DATA_DIRNAME, 'snapshot', 'test'))).to.be.true
        });

        it('should generate a backup.json file with metadata', async () => {
            let backup: Backup = new Backup();
            backup.setComment('test comment');
            backup = await backup.create(service.config.data_dir);

            expect(fs.existsSync(path.join(backup.path, Backup.METADATA_FILENAME))).to.be.true;

            const metadata: object = JSON.parse(fs.readFileSync(path.join(backup.path, Backup.METADATA_FILENAME)).toString());

            expect(metadata).to.be.deep.equal({
                name: backup.name,
                timestamp: backup.timestamp,
                version: app.version.tag,
                comment: 'test comment',
                imported: false,
                hash: crypto.createHmac('sha256', testSuite.app.config.get('crypt.secret'))
                .update(backupDigestContent)
                .digest('hex')
            });
        });
    });

    describe('load()', () => {

        it('should load the metadata file', async () => {
            let backup: Backup = new Backup();
            backup.setComment('test comment');
            backup = await backup.create(service.config.data_dir);

            const b2: Backup = await new Backup().load(backup.path);

            expect(b2.name).to.be.deep.equal(backup.name);
            expect(b2.timestamp).to.be.deep.equal(backup.timestamp);
            expect(b2.version).to.be.deep.equal(backup.version);
            expect(b2.comment).to.be.deep.equal(backup.comment);
        });

        it('an absolute path should transform the path to relative', async () => {
            let backup: Backup = new Backup();
            backup = await backup.create(path.join(process.cwd(), service.config.data_dir));

            expect(backup.path.startsWith(service.config.data_dir)).to.be.true;
        });
    });

    describe('restore()', () => {
        let backup: Backup;
        let databaseService: DatabaseService

        beforeEach(async () => {
            backup = new Backup();
            backup = await backup.create(service.config.data_dir);

            databaseService = await app.getService<DatabaseService>(DatabaseService.name);
        })

        it('should throw error exception if mysql command doesn\'t exists', async () => {
            let backup: Backup = new Backup();
            sinon.stub(backup, 'existsCmd').callsFake(cmd => { return Promise.resolve(false)});

            const t = () => {
                return backup.restore(service.config.data_dir); 
            }

            await expect(t()).to.be.rejectedWith('Command mysql not found or it is not possible to execute it');
        });

        it('should import the database', async () => {
            await databaseService.emptyDatabase();

            backup = await backup.restore();

            const queryRunner: QueryRunner = databaseService.connection.createQueryRunner();

            expect(await queryRunner.hasTable('ca')).to.be.true;
            
            await queryRunner.release();
        });

        it('should import pki directories if it exists in the backup', async () => {
            let backup: Backup = new Backup();

            FSHelper.mkdirSync(path.join(app.config.get('pki').data_dir, 'test'));
            backup = await backup.create(service.config.data_dir);

            backup = await backup.restore();

            expect(FSHelper.directoryExistsSync(path.join(app.config.get('pki').data_dir, 'test'))).to.be.true
        });

        it('should import policy directories if it exists in the backup', async () => {
            let backup: Backup = new Backup();

            FSHelper.mkdirSync(path.join(app.config.get('policy').data_dir, 'test'));
            backup = await backup.create(service.config.data_dir);

            backup = await backup.restore();

            expect(FSHelper.directoryExistsSync(path.join(app.config.get('policy').data_dir, 'test'))).to.be.true
        })

        it('should import snapshot directories if it exists in the backup', async () => {
            let backup: Backup = new Backup();

            FSHelper.mkdirSync(path.join(app.config.get('snapshot').data_dir, 'test'));
            backup = await backup.create(service.config.data_dir);

            backup = await backup.restore();

            expect(FSHelper.directoryExistsSync(path.join(app.config.get('snapshot').data_dir, 'test'))).to.be.true
        })

        it('should remove compilation status from firewalls', async () => {
            let fwCloud: FwCloud = await FwCloud.save(FwCloud.create({ name: 'test' }));
            
            let firewall: Firewall = await Firewall.save(Firewall.create({ name: 'test', fwCloud: fwCloud, status: 1, installed_at: moment().utc().format(), compiled_at: moment().utc().format() }));
            
            let backup: Backup = new Backup();
            backup = await backup.create(service.config.data_dir);

            backup = await backup.restore();

            firewall = await Firewall.findOne(firewall.id);

            expect(firewall.status).to.be.deep.eq(3);
            expect(firewall.installed_at).to.be.null;
            expect(firewall.compiled_at).to.be.null;

        });
    
        it('should run migrations', async () => {
            const migrations: Migration[] = await databaseService.getExecutedMigrations();

            await databaseService.rollbackMigrations(3);
            
            backup = new Backup();
            await backup.create(service.config.data_dir);
            await backup.restore();

            const newMigrations: Migration[] = await databaseService.getExecutedMigrations();
            
            expect(newMigrations.length).to.be.deep.eq(migrations.length);
        });

        it('should remove encrypted data if export snapshot hash is not equal', async () => {
            let fwCloud: FwCloud = await FwCloud.save(FwCloud.create({ name: 'test' }));
            let firewall: Firewall = await Firewall.save(Firewall.create({
                name: 'firewall_test',
                status: 1,
                fwCloudId: fwCloud.id,
                install_user: 'test',
                install_pass: 'test'
            }));

            backup = new Backup();
            await backup.create(service.config.data_dir);

            const backupMetadata: BackupMetadata = JSON.parse(fs.readFileSync(path.join(backup.path, Backup.METADATA_FILENAME)).toString());
            backupMetadata.hash = 'test';
            fs.writeFileSync(path.join(backup.path, Backup.METADATA_FILENAME), JSON.stringify(backupMetadata, null, 2));
            backup = await new Backup().load(backup.path);

            await backup.restore();

            firewall = await Firewall.findOne(firewall.id);

            expect(firewall.install_user).to.be.null;
            expect(firewall.install_pass).to.be.null;
        });
    });

    describe('delete()', () => {

        it('should remove the backup', async () => {
            let backup: Backup = new Backup();
            backup = await backup.create(service.config.data_dir);

            backup = await backup.destroy();

            expect(fs.existsSync(backup.path)).to.be.false;
        });
    });

    describe('toResponse()', () => {

        it('should return all required properties', async () => {
            let backup: Backup = new Backup();
            backup = await backup.create(service.config.data_dir);

            expect(backup.toResponse()).to.be.deep.eq({
                id: backup.id,
                name: backup.name,
                date: backup.date.utc(),
                comment: backup.comment,
                version: backup.version,
                imported: false
            })
        });
    });

    describe('buildCmd()', () => {

        let databaseService: DatabaseService;
        let dbConfig: DatabaseConfig;

        beforeEach(async () => {
            databaseService = await app.getService<DatabaseService>(DatabaseService.name);
            dbConfig = databaseService.config;
        })

        it('should build the correct mysldump/mysql command', async () => {
            let backup: Backup = new Backup();
            await backup.create(service.config.data_dir);

            process.env.NODE_ENV = 'prod';
            expect(backup.buildCmd('mysqldump',databaseService)).to.be.deep.eq(`mysqldump -h "${dbConfig.host}" -P ${dbConfig.port} -u ${dbConfig.user} ${dbConfig.name} > "${backup.path}/db.sql"`);
            expect(backup.buildCmd('mysql',databaseService)).to.be.deep.eq(`mysql -h "${dbConfig.host}" -P ${dbConfig.port} -u ${dbConfig.user} ${dbConfig.name} < "${backup.path}/db.sql"`);
            process.env.NODE_ENV = 'test';
        });

        it('should include --protocol=TCP in test environment', async () => {
            let backup: Backup = new Backup();
            await backup.create(service.config.data_dir);

            process.env.NODE_ENV = 'test';
            expect(backup.buildCmd('mysqldump',databaseService)).to.be.deep.eq(`mysqldump --protocol=TCP -h "${dbConfig.host}" -P ${dbConfig.port} -u ${dbConfig.user} ${dbConfig.name} > "${backup.path}/db.sql"`);
            expect(backup.buildCmd('mysql',databaseService)).to.be.deep.eq(`mysql --protocol=TCP -h "${dbConfig.host}" -P ${dbConfig.port} -u ${dbConfig.user} ${dbConfig.name} < "${backup.path}/db.sql"`);
        });
    });
});