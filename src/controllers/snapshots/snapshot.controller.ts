import { Controller } from "../../fonaments/http/controller";
import { SnapshotService } from "../../snapshots/snapshot.service";
import { ResponseBuilder } from "../../fonaments/http/response-builder";
import { Snapshot } from "../../snapshots/snapshot";
import { SnapshotPolicy } from "../../policies/snapshot.policy";
import { Request } from "express";
import { NotFoundException } from "../../fonaments/exceptions/not-found-exception";
import { FwCloud } from "../../models/fwcloud/FwCloud";
import { RepositoryService } from "../../database/repository.service";

export class SnapshotController extends Controller {

    protected _snapshotService: SnapshotService;
    protected _repositoryService: RepositoryService;

    public async make() {
        this._snapshotService = await this._app.getService<SnapshotService>(SnapshotService.name);
        this._repositoryService = await this._app.getService<RepositoryService>(RepositoryService.name);
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

    public async store(request: Request): Promise<ResponseBuilder> {
        const fwcloud: FwCloud = await (this._repositoryService.for(FwCloud).findOne(request.body.fwcloud_id));

        (await SnapshotPolicy.create(fwcloud, request.session.user)).authorize();

        const snapshot: Snapshot = await this._snapshotService.store(request.inputs.get('name'), request.inputs.get('commnet', null), fwcloud);

        return ResponseBuilder.buildResponse().status(201).body(snapshot);
    }

    public async update(request: Request): Promise<ResponseBuilder> {
        let snapshot: Snapshot = await this._snapshotService.findOneOrDie(parseInt(request.params.snapshot));

        (await SnapshotPolicy.update(snapshot, request.session.user)).authorize();

        snapshot = await this._snapshotService.update(snapshot, {name: request.inputs.get('name'), comment: request.inputs.get('comment')});

        return ResponseBuilder.buildResponse().status(200).body(snapshot);
    }

    public async destroy(request: Request): Promise<ResponseBuilder> {
        let snapshot: Snapshot = await this._snapshotService.findOneOrDie(parseInt(request.params.snapshot));

        (await SnapshotPolicy.destroy(snapshot, request.session.user)).authorize();

        snapshot = await this._snapshotService.destroy(snapshot);

        return ResponseBuilder.buildResponse().status(204).body(snapshot);
    }
}