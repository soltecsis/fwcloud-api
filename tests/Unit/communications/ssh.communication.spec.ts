import axios from 'axios';
import sinon from "sinon";
import { CCDHash } from "../../../src/communications/communication";
import { expect } from "../../mocha/global-setup";
import { SSHCommunication } from "../../../src/communications/ssh.communication";
import sshTools from "../../../src/utils/ssh";

describe(SSHCommunication.name, () => {
    let ssh: SSHCommunication;

    beforeEach(async() => {
        ssh = new SSHCommunication({
            host: 'host',
            port: 0,
            username: "username",
            password: "password",
            options: 0,
        });
    });

    describe('ccdHashList', () => {
        let stub: sinon.SinonStub;
        
        beforeEach(() => {
            stub = sinon.stub(sshTools, "runCommand");
            stub.returns(Promise.resolve("file,sha256\ncrt1,hash1\ncrt2,hash2"))
        });

        it('should parse CSV content', async () => {
            const result: CCDHash[] = await ssh.ccdHashList("");

            expect(result).to.deep.eq([
                { filename: 'crt1', hash: 'hash1' },
                { filename: 'crt2', hash: 'hash2' }
            ])
        })
    })
});