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

    let app: Application;

    
    describe('CommunicationController@SSH',() => {
        beforeEach(()=>{
            app.config.set('session.ssh_enable',false);
        });

        it.skip('Install Firewall Policy', async () => {
            loggedUser.fwClouds = [fwCloud];
            await getRepository(User).save(loggedUser);

            return await request(app.express)
                .post(`policy/install?channel_id=${channel_id}`)
                .send({
                    fwcloud: fwCloud.id,
                    firewall: firewall.id,
                    sshuser: firewall.install_user,
                    sshpass: firewall.install_pass,
                    communication: 'ssh'
                })
                .set('Cookie', [attachSession(loggedUserSessionId)])
                .then(res => {console.log(res.body)})
        });
        it('Install OpenVPN Server Configs');
        it('Install OpenVPN Client Configs');
        it('Unistall OpenVPN Configs');
        
        it('Autodiscover Interfaces',async ()=>{
            loggedUser.fwClouds = [fwCloud];
            await getRepository(User).save(loggedUser);

            return await request(app.express)
                .put('/interface/autodiscover')
                .send({
                    fwcloud: fwCloud.id,
                    ip: '1.1.1.1',
                    port: 1234,
                    communication: 'ssh',
                    sshuser: firewall.install_user,
                    sshpass: firewall.install_pass
                })
                .set('Cookie',[attachSession(loggedUserSessionId)])
                .expect(400,{"fwcErr": 9000, "msg":"Communication by means of SSH is forbidden in the API"})
        });

        it('Import IP Tables',async () => {

        });
        it('Export IP Tables');
        it('CCD Hash List');
        it('Get Real Time Status');
    })
});