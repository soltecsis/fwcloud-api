import { Policy, Authorization } from "../fonaments/authorization/policy";
import { Snapshot } from "../snapshots/snapshot";
import { User } from "../models/user/User";
import { FwCloud } from "../models/fwcloud/FwCloud";

export class SnapshotPolicy extends Policy {

    static async read(snapshot: Snapshot, user: User): Promise<Authorization> {
        
        if (user.role === 1) {
            return Authorization.grant();
        }

        if (snapshot.fwCloud) {
            const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === snapshot.fwCloud.id});

            return match.length > 0 ? Authorization.grant() : Authorization.revoke();
        }
        return Authorization.revoke();
    }

    static async create(fwcloud: FwCloud, user: User): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        const match = user.fwClouds.filter((_fwcloud) => { return _fwcloud.id === fwcloud.id});

        return match.length > 0 ? Authorization.grant() : Authorization.revoke();
    }

    static async update(snapshot: Snapshot, user: User): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        if (snapshot.fwCloud) {
            const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === snapshot.fwCloud.id});

            return match.length > 0 ? Authorization.grant() : Authorization.revoke();
        }
        return Authorization.revoke();
    }

    static async restore(snapshot: Snapshot, user: User): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        if (snapshot.fwCloud) {
            const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === snapshot.fwCloud.id});

            return match.length > 0 ? Authorization.grant() : Authorization.revoke();
        }
        return Authorization.revoke();
    }

    static async destroy(snapshot: Snapshot, user: User): Promise<Authorization> {
        if (user.role === 1) {
            return Authorization.grant();
        }

        if (snapshot.fwCloud) {
            const match = user.fwClouds.filter((fwcloud) => { return fwcloud.id === snapshot.fwCloud.id});

            return match.length > 0 ? Authorization.grant() : Authorization.revoke();
        }
        return Authorization.revoke();
    }

}