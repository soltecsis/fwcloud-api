import { Service } from "../fonaments/services/service";
import { Snapshot } from "./snapshot";
import * as fs from "fs";
import * as path from "path";

export type SnapshotConfig = {
    data_dir: string
};

export class SnapshotService extends Service {
    protected _config: SnapshotConfig;

    public async build(): Promise<SnapshotService> {
        this._config = this._app.config.get('snapshot');
        return this;
    }

    public async getAll(): Promise<Array<Snapshot>> {
        const snapshots: Array<Snapshot> = [];

        const entires: Array<string> = fs.readdirSync(this._config.data_dir);
        for (let entry of entires) {
            let snapshotPath: string = path.join(this._config.data_dir, entry);

            if (fs.statSync(snapshotPath).isFile()) {
                snapshots.push(await Snapshot.load(snapshotPath));
            }
        }

        return snapshots;
    }
    
    public async findOne(id: number): Promise<Snapshot> {
        let snapshots: Array<Snapshot> = await this.getAll();

        const results = snapshots.filter((snapshot: Snapshot) => {
            return snapshot.id === id;
        });

        return results.length > 0 ? results[0] : null;
    }

    public async remove(snapshot: Snapshot): Promise<Snapshot> {
        return await snapshot.remove();
    }
}