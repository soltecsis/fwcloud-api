import { Controller } from "../../fonaments/http/controller";
import { SnapshotService } from "../../snapshots/snapshot.service";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Snapshot } from "../../snapshots/snapshot";

export class SnapshotController extends Controller {

    protected _snapshotService: SnapshotService;

    public async make() {
        this._snapshotService = await this._app.getService<SnapshotService>(SnapshotService.name);
    }

    public async index(request: Request): Promise<ResponseBuilder> {
        const snapshosts: Array<Snapshot> = await this._snapshotService.getAll();

        return ResponseBuilder.buildResponse().status(200).body(snapshosts);
    }
}