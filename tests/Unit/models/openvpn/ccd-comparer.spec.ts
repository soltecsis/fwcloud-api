import { CCDHash } from "../../../../src/communications/communication";
import { CCDComparation, CCDComparer } from "../../../../src/models/vpn/openvpn/ccd-comparer";
import { expect } from "../../../mocha/global-setup";

describe(CCDComparer.name + ' Unit Tests', () => {
    let local: CCDHash[];
    let remote: CCDHash[];

    beforeEach(async () => {
        local = [
            { filename: 'onlylocal', hash: 'onlylocal' },
            { filename: 'synced', hash: 'synced' },
            { filename: 'unsynced', hash: 'unsynced' },
        ];

        remote = [
            { filename: 'onlyremote', hash: 'onlyremote' },
            { filename: 'synced', hash: 'synced' },
            { filename: 'unsynced', hash: 'other_hash' },
        ]
    });

    it('should compare files', () => {
        const result: CCDComparation = CCDComparer.compare(local, remote);
        
        expect(result.onlyLocal).to.deep.eq(['onlylocal']);
        expect(result.onlyRemote).to.deep.eq(['onlyremote']);
        expect(result.synced).to.deep.eq(['synced']);
        expect(result.unsynced).to.deep.eq(['unsynced']);
    });
});
