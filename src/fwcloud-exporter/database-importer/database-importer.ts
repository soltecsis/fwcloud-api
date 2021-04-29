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
import { QueryRunner, DeepPartial, createQueryBuilder } from "typeorm";
import { app } from "../../fonaments/abstract-application";
import { DatabaseService } from "../../database/database.service";
import { Terraformer } from "./terraformer/terraformer";
import { IdManager } from "./terraformer/mapper/id-manager";
import { ImportMapping } from "./terraformer/mapper/import-mapping";
import * as path from "path";
import { Firewall } from "../../models/firewall/Firewall";
import { FSHelper } from "../../utils/fs-helper";
import { PathHelper } from "../../utils/path-helpers";
import { Ca } from "../../models/vpn/pki/Ca";
import * as fs from "fs";
import { EventEmitter } from "events";
import { Worker } from 'worker_threads';
import { InputData, OutputData } from "./terraform_table.service";
import { ProgressNoticePayload } from "../../sockets/messages/socket-message";

export class DatabaseImporter {
    protected _mapper: ImportMapping;
    protected _idManager: IdManager;

    constructor(protected readonly eventEmitter: EventEmitter = new EventEmitter()) {}

    get mapper(): ImportMapping {
        return this._mapper;
    }

    get idManager(): IdManager {
        return this._idManager;
    }


    public async import(snapshot: Snapshot): Promise<FwCloud> {
        const promises: Promise<any>[] = [];
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        let data: ExporterResult = new ExporterResult(JSON.parse(fs.readFileSync(path.join(snapshot.path, Snapshot.DATA_FILENAME)).toString()));
        let fwCloudId: number = null;

        await queryRunner.startTransaction();
        
        try {
            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');

            this._idManager = await IdManager.make(queryRunner, data.getTableNames())
            this._mapper = new ImportMapping(this._idManager, data);
            let index: number = 1;
            for (const tableName of data.getTableNames()) {
                this.eventEmitter.emit('message', new ProgressNoticePayload(`${index}/${data.getTableNames().length}`));
                const outputData: OutputData = data.getTableResults(tableName).length === 0 ? {result: [], idMaps: this._mapper.maps, idState: this._idManager.getIdState()} : await this.handleTableResultTerraform(tableName, this._mapper, this._idManager, data);

                //Refresh mapper after calling service
                this._mapper.maps = outputData.idMaps;
                this._idManager = IdManager.restore(outputData.idState);
                const terraformedData: object[] = outputData.result;

                if (tableName === FwCloud._getTableName()) {
                    fwCloudId = (terraformedData as any)[0].id;
                }

                while(terraformedData.length > 0) {
                    const chunk = terraformedData.splice(0, 10000);
                    const pquery: Promise<any> = queryRunner.manager.createQueryBuilder().insert().into(tableName).values(chunk).execute();
                    promises.push(pquery);
                }
                index++;
            };

            await Promise.all(promises);

            await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
            await queryRunner.commitTransaction();
        } catch(e) {
            await queryRunner.rollbackTransaction();
            throw e;
        } finally {
            await queryRunner.release();
        }

        const fwCloud: FwCloud = await FwCloud.findOne(fwCloudId);

        await DatabaseImporter.importDataDirectories(snapshot.path, fwCloud, this._mapper);

        return fwCloud;
    }

    protected async handleTableResultTerraform(tableName: string, mapper: ImportMapping, idManager: IdManager, data: ExporterResult): Promise<OutputData> {
        return new Promise<OutputData>((resolve, reject) => {
            const wData: InputData = {
                tableName: tableName,
                data: data.getAll(),
                idMaps: mapper.maps,
                idState: idManager.getIdState()
            }

            const worker = new Worker(path.join(__dirname, 'terraform_table.service.js'), {
                workerData: wData
            });

            worker.on('message', (data: OutputData) => {
                return resolve(data)
            });

            worker.on('error', err => {
                return reject(err);
            })
        });
    }
    protected static async importDataDirectories(snapshotPath: string, fwCloud: FwCloud, mapper: ImportMapping): Promise<void> {
        FSHelper.rmDirectorySync(fwCloud.getPkiDirectoryPath());
        FSHelper.rmDirectorySync(fwCloud.getPolicyDirectoryPath());
        FSHelper.rmDirectorySync(fwCloud.getSnapshotDirectoryPath());
        
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