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

import { Snapshot } from "../../snapshots/snapshot";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { ExporterResult } from "../database-exporter/exporter-result";
import { QueryRunner, DeepPartial } from "typeorm";
import { app } from "../../fonaments/abstract-application";
import { DatabaseService } from "../../database/database.service";
import { Terraformer } from "./terraformer/terraformer";
import { IdManager } from "./terraformer/mapper/id-manager";
import { ImportMapping } from "./terraformer/mapper/import-mapping";
import { RepositoryService } from "../../database/repository.service";
import * as path from "path";
import { Firewall } from "../../models/firewall/Firewall";
import { FSHelper } from "../../utils/fs-helper";
import { PathHelper } from "../../utils/path-helpers";
import { Ca } from "../../models/vpn/pki/Ca";
import Model from "../../models/Model";
import * as fs from "fs";

export class DatabaseImporter {
    protected _mapper: ImportMapping;
    protected _idManager: IdManager;
    
    get mapper(): ImportMapping {
        return this._mapper;
    }

    get idManager(): IdManager {
        return this._idManager;
    }


    public async import(snapshotPath: string): Promise<FwCloud> { 
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        const repositoryService: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name);
        
        let data: ExporterResult = new ExporterResult(JSON.parse(fs.readFileSync(path.join(snapshotPath, Snapshot.DATA_FILENAME)).toString()));
        
        this._idManager = await IdManager.make(queryRunner, data.getTableNames())
        this._mapper = new ImportMapping(this._idManager, data);
        

        const terraformedData: ExporterResult = await (new Terraformer(queryRunner, this._mapper)).terraform(data);
        
        await this.importToDatabase(queryRunner, terraformedData);
        
        const fwCloud: FwCloud = await repositoryService.for(FwCloud).findOne((<DeepPartial<FwCloud>>data.getAll()[FwCloud._getTableName()][0]).id);

        await DatabaseImporter.importDataDirectories(snapshotPath, fwCloud, this._mapper);

        await queryRunner.release();

        return fwCloud;
    }

    /**
     * Import data into the database
     * 
     * @param queryRunner 
     * @param data 
     */
    protected async importToDatabase(queryRunner: QueryRunner, data: ExporterResult): Promise<void> {
        
        await queryRunner.startTransaction()
        try {
            
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
            for(let tableName in data.getAll()) {
                const entity: typeof Model = Model.getEntitiyDefinition(tableName);

                if (entity) {
                    await queryRunner.manager.getRepository(entity).save(data.getAll()[tableName], {chunk: 10000});
                } else {
                    for(let i = 0; i < data.getAll()[tableName].length; i++) {
                        const row: object = data.getAll()[tableName][i];
                        await queryRunner.manager.createQueryBuilder().insert().into(tableName).values(row).execute();
                    }
                }
            }
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
        } catch (e) {
            await queryRunner.rollbackTransaction();
            throw e;
        }
        
        return null;
    }

    protected static async importDataDirectories(snapshotPath: string, fwCloud: FwCloud, mapper: ImportMapping): Promise<void> {
        if(FSHelper.directoryExistsSync(path.join(snapshotPath, Snapshot.PKI_DIRECTORY))) {
            await this.importPKIDirectory(path.join(snapshotPath, Snapshot.PKI_DIRECTORY), fwCloud, mapper);
        }

        if(FSHelper.directoryExistsSync(path.join(snapshotPath, Snapshot.POLICY_DIRECTORY))) {
            await this.importPolicyDirectory(path.join(snapshotPath, Snapshot.POLICY_DIRECTORY), fwCloud, mapper);
        }
    }

    protected static async importPKIDirectory(directoryPath: string, fwCloud: FwCloud, mapper: ImportMapping): Promise<void> {
        const directories: Array<string> = await FSHelper.directories(directoryPath);

        for(let i = 0; i < directories.length; i++) {
            const directory: string = directories[i];
            const oldCaId: number = parseInt(PathHelper.directoryName(directory));
            const newCaId: number = mapper.getMappedId(Ca._getTableName(), Ca.getPrimaryKeys()[0].propertyName, oldCaId);
            const importDirectory: string = path.join(path.join(app().config.get('pki').data_dir, fwCloud.id.toString(), newCaId.toString()));
            await FSHelper.copy(directory, importDirectory);
        }
    }

    protected static async importPolicyDirectory(directoryPath: string, fwCloud: FwCloud, mapper: ImportMapping): Promise<void> {
        const directories: Array<string> = await FSHelper.directories(directoryPath);

        for(let i = 0; i < directories.length; i++) {
            const directory: string = directories[i];
            const oldFirewallId: number = parseInt(PathHelper.directoryName(directory));
            const newFirewallId: number = mapper.getMappedId(Firewall._getTableName(), Firewall.getPrimaryKeys()[0].propertyName, oldFirewallId);
            const importDirectory: string = path.join(path.join(app().config.get('policy').data_dir, fwCloud.id.toString(), newFirewallId.toString()));
            await FSHelper.copy(directory, importDirectory);
        }
    }
}