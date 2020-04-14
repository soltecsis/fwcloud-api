import { Snapshot } from "../../snapshots/snapshot";
import { NotFoundException } from "../../fonaments/exceptions/not-found-exception";
import { Progress } from "../../fonaments/http/progress/progress";
import { SnapshotData } from "../../snapshots/snapshot-data";
import { Task } from "../../fonaments/http/progress/task";
import { DatabaseDataImporter } from "./database-data-importer";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { ExporterResults } from "../exporter/exporter-results";

export class Importer {
    protected _fwcloudId: number = null;

    public async import(path: string): Promise<Progress<Snapshot>> { 
        try {
            const snapshot: Snapshot = await Snapshot.load(path);
            const progress: Progress<Snapshot> = new Progress<Snapshot>(snapshot);

            progress.procedure('Importing FwCloud', (task: Task) => {
                task.addTask(async () => { 
                    const fwCloud = await this.importDatabaseData(snapshot.data);
                    this._fwcloudId = fwCloud.id;
                    return fwCloud;
                }, 'FwCloud database imported');
            }, 'FwCloud imported');

            return progress;
        } catch(e) {
            throw new NotFoundException();
        }
    }

    public importDatabaseData(data: SnapshotData): Promise<FwCloud> {
        const databaseDataImporter: DatabaseDataImporter = new DatabaseDataImporter(new ExporterResults().fromSnapshotData(data));
        return databaseDataImporter.import();
    }
}