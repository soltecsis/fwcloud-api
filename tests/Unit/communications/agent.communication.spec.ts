import { AgentCommunication } from "../../../src/communications/agent.communication";
import axios from 'axios';
import sinon from "sinon";
import { CCDHash } from "../../../src/communications/communication";
import { expect } from "../../mocha/global-setup";

describe(AgentCommunication.name, () => {
    let agent: AgentCommunication;

    beforeEach(async() => {
        agent = new AgentCommunication({
            protocol: 'http',
            host: 'host',
            port: 0,
            apikey: ''
        });
    });

    describe('ccdHashList', () => {
        let stub: sinon.SinonStub;
        
        beforeEach(() => {
            stub = sinon.stub(axios, "put");
            stub.returns(Promise.resolve({
                status: 200,
                data: "file,sha256\ncrt1,hash1\ncrt2,hash2"
            }))
        });

        it('should parse CSV content', async () => {
            const result: CCDHash[] = await agent.ccdHashList("");

            expect(result).to.deep.eq([
                { filename: 'crt1', hash: 'hash1' },
                { filename: 'crt2', hash: 'hash2' }
            ])
        })
    })
});