/*
    Copyright 2022 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

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
            stub.returns(Promise.resolve("\r\nfile,sha256\ncrt1,hash1\ncrt2,hash2"))
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