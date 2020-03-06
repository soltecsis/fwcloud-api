import { Controller } from "../../fonaments/http/controller";
import { SnapshotService } from "../../snapshots/snapshot.service";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Snapshot } from "../../snapshots/snapshot";
import { SnapshotPolicy } from "../../policies/snapshot.policy";
import { Request } from "express";
import { NotFoundException } from "../../fonaments/exceptions/not-found-exception";

export class SnapshotController extends Controller {

    protected _snapshotService: SnapshotService;

    public async make() {
        this._snapshotService = await this._app.getService<SnapshotService>(SnapshotService.name);
    }

    public async index(request: Request): Promise<ResponseBuilder> {
        const snapshots: Array<Snapshot> = await this._snapshotService.getAll();

        for(let i = 0; i < snapshots.length; i++) {
            if (!(await SnapshotPolicy.read(snapshots[i], request.session.user)).can()) {
                snapshots.splice(i, 1);
            }
        }

        return ResponseBuilder.buildResponse().status(200).body(snapshots);
    }

    public async show(request: Request): Promise<ResponseBuilder> {
        const snapshot: Snapshot = await this._snapshotService.findOneOrDie(parseInt(request.params.snapshot));

        if (!(await SnapshotPolicy.read(snapshot, request.session.user)).can()) {
            throw new NotFoundException();
        }

        return ResponseBuilder.buildResponse().status(200).body(snapshot);
    }
}