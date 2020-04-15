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

import { Backup } from "../../../src/backups/backup";
import * as fs from "fs";
import * as path from "path";
import { DatabaseService } from "../../../src/database/database.service";
import { expect, testSuite, describeName } from "../../mocha/global-setup";
import { BackupService } from "../../../src/backups/backup.service";
import { Application } from "../../../src/Application";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { RepositoryService } from "../../../src/database/repository.service";
import { Repository } from "typeorm";
import { Firewall } from "../../../src/models/firewall/Firewall";
import moment from "moment";

let app: Application;
let service: BackupService;

describe(describeName('Backup tests'), () => {
    
    beforeEach(async () => {
        app = testSuite.app;
        service = await app.getService<BackupService>(BackupService.name);
    })

    it('exists should return false if the backup is not persisted', async () => {
        const backup: Backup = new Backup();
        expect(backup.exists()).to.be.false;
    });

    it('create() should create a backup directory', async () => {
        let backup: Backup = new Backup();
        await backup.create(service.config.data_dir);
        expect(backup.exists()).to.be.true;
        expect(backup.id).not.to.be.null;
        expect(fs.existsSync(backup.path)).to.be.true;
    });

    it('create() should create a dump file', async () => {
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);
        expect(fs.existsSync(path.join(backup.path, Backup.DUMP_FILENAME))).to.be.true;
    });

    it('create() should copy data files if exists', async () => {
        //TODO
    });

    it('create() should generate a backup.json file with metadata', async () => {
        let backup: Backup = new Backup();
        backup.setComment('test comment');
        backup = await backup.create(service.config.data_dir);

        expect(fs.existsSync(path.join(backup.path, Backup.METADATA_FILENAME))).to.be.true;

        const metadata: object = JSON.parse(fs.readFileSync(path.join(backup.path, Backup.METADATA_FILENAME)).toString());

        expect(metadata).to.be.deep.equal({
            name: backup.name,
            timestamp: backup.timestamp,
            version: app.version.tag,
            schema: app.version.schema,
            comment: 'test comment',
        });
    });

    it('load() should load the metadata file', async () => {
        let backup: Backup = new Backup();
        backup.setComment('test comment');
        backup = await backup.create(service.config.data_dir);

        const b2: Backup = await new Backup().load(backup.path);

        expect(b2.name).to.be.deep.equal(backup.name);
        expect(b2.timestamp).to.be.deep.equal(backup.timestamp);
        expect(b2.version).to.be.deep.equal(backup.version);
        expect(b2.comment).to.be.deep.equal(backup.comment);
    })

    it('restore() should import the database', async () => {
        const databaseService: DatabaseService = await app.getService<DatabaseService>(DatabaseService.name);
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);

        await databaseService.emptyDatabase();

        backup = await backup.restore();

        expect(await databaseService.connection.createQueryRunner().hasTable('ca')).to.be.true;

        await databaseService.emptyDatabase();
    });

    it('restore() should remove compilation status from firewalls', async () => {
        const repositoryService: RepositoryService = await app.getService<RepositoryService>(RepositoryService.name);
        const fwCloudRepository: Repository<FwCloud> = repositoryService.for(FwCloud);
        const firewallRepository: Repository<Firewall> = repositoryService.for(Firewall);

        let fwCloud: FwCloud = fwCloudRepository.create({ name: 'test' });
        fwCloud = await fwCloudRepository.save(fwCloud, { reload: true });

        let firewall: Firewall = firewallRepository.create({ name: 'test', fwCloud: fwCloud, status: 1, installed_at: moment().utc().format(), compiled_at: moment().utc().format() });
        firewall = await firewallRepository.save(firewall, { reload: true });

        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);

        backup = await backup.restore();

        firewall = await firewallRepository.findOne(firewall.id);

        expect(firewall.status).to.be.deep.eq(3);
        expect(firewall.installed_at).to.be.null;
        expect(firewall.compiled_at).to.be.null;

    })

    it('delete() should remove the backup', async () => {
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);

        backup = await backup.destroy();

        expect(fs.existsSync(backup.path)).to.be.false;
    });

    it('load() an absolute path should transform the path to relative', async () => {
        let backup: Backup = new Backup();
        backup = await backup.create(path.join(process.cwd(), service.config.data_dir));

        expect(backup.path.startsWith(service.config.data_dir)).to.be.true;
    });

    it('toResponse() should return all required properties', async () => {
        let backup: Backup = new Backup();
        backup = await backup.create(service.config.data_dir);

        expect(backup.toResponse()).to.be.deep.eq({
            id: backup.id,
            name: backup.name,
            date: backup.date.utc(),
            comment: backup.comment,
            version: backup.version,
            schema: backup.schema
        })
    })
});