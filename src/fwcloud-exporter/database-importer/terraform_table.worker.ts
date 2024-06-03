import { workerData, parentPort } from 'worker_threads';
import { ExporterResult, ExporterResultData } from '../database-exporter/exporter-result';
import { IdManager, TableIdState } from './terraformer/mapper/id-manager';
import { ImportMapping } from './terraformer/mapper/import-mapping';
import { Terraformer } from './terraformer/terraformer';
import { EventEmitter } from 'typeorm/platform/PlatformTools';

export type InputData = {
    tableName: string,
    data: ExporterResultData,
    idMaps: Map<string,number>,
    idState: TableIdState
}

export type OutputData = {
    result: object[];
    error?: {
        message: string,
        stack: string
    }
    idMaps: Map<string, number>;
    idState: TableIdState
}

async function terraformTable(tableName: string, mapper: ImportMapping, data: object[]): Promise<object[]> {
    return await (new Terraformer(mapper, this ? this.eventEmitter : new EventEmitter()))
        .terraform(tableName, data);
}

const sharedData: InputData = workerData;
const idManager: IdManager = IdManager.restore(sharedData.idState)
const result: ExporterResult = new ExporterResult(sharedData.data);
const mapper: ImportMapping = new ImportMapping(idManager, result, sharedData.idMaps);

terraformTable(sharedData.tableName, mapper, result.getTableResults(sharedData.tableName))
    .then( data => {
        const output: OutputData = {
            result: data,
            idMaps: mapper.maps,
            idState: idManager.getIdState()
        }
        parentPort.postMessage(output);
    })
    .catch(err => {
        const output: OutputData = {
            result: null,
            error: {
                message: err.message,
                stack: err.stack ?? null
            },
            idMaps: mapper.maps,
            idState: idManager.getIdState()
        }
        
        parentPort.postMessage(output)
    })