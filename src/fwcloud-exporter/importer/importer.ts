import { Snapshot } from "../../snapshots/snapshot";
import { DatabaseDataImporter } from "./database-data-importer";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { ExporterResult } from "../exporter/exporter-result";
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
import moment from "moment";

export class Importer {
    protected _mapper: ImportMapping;
    protected _idManager: IdManager;
    
    get mapper(): ImportMapping {
        return this._mapper;
    }

    get idManager(): IdManager {
        return this._idManager;
    }


    public async import(snapshotPath: string): Promise<FwCloud> { 
        const snapshot: Snapshot = await Snapshot.load(snapshotPath);
        const queryRunner: QueryRunner = (await app().getService<DatabaseService>(DatabaseService.name)).connection.createQueryRunner();
        const repositoryService: RepositoryService = await app().getService<RepositoryService>(RepositoryService.name);
        
        let data: ExporterResult = new ExporterResult().fromSnapshotData(snapshot.data);
        
        this._idManager = await IdManager.make(queryRunner, data.getTableWithEntities())
        this._mapper = new ImportMapping(this._idManager, data);
        

        const terraformedData: ExporterResult = await (new Terraformer(queryRunner, this._mapper)).terraform(data);
        
        await DatabaseDataImporter.import(queryRunner, terraformedData);
        
        const fwCloud: FwCloud = await repositoryService.for(FwCloud).findOne((<DeepPartial<FwCloud>>data.getAll()[FwCloud._getTableName()].data[0]).id);

        await Importer.importDataDirectories(snapshotPath, fwCloud, this._mapper);

        return fwCloud;
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
            const importDirectory: string = path.join(path.join(app().config.get('policy').data_dir, fwCloud.id.toString(), newCaId.toString()));
            await FSHelper.copyDirectory(directory, importDirectory);
        }
    }

    protected static async importPolicyDirectory(directoryPath: string, fwCloud: FwCloud, mapper: ImportMapping): Promise<void> {
        const directories: Array<string> = await FSHelper.directories(directoryPath);

        for(let i = 0; i < directories.length; i++) {
            const directory: string = directories[i];
            const oldFirewallId: number = parseInt(PathHelper.directoryName(directory));
            const newFirewallId: number = mapper.getMappedId(Firewall._getTableName(), Firewall.getPrimaryKeys()[0].propertyName, oldFirewallId);
            const importDirectory: string = path.join(path.join(app().config.get('policy').data_dir, fwCloud.id.toString(), newFirewallId.toString()));
            await FSHelper.copyDirectory(directory, importDirectory);
        }
    }
}