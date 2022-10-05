import axios from 'axios';
import sinon from "sinon";
import { CCDHash } from "../../../src/communications/communication";
import { expect, testSuite } from "../../mocha/global-setup";
import { SSHCommunication } from "../../../src/communications/ssh.communication";
import sshTools from "../../../src/utils/ssh";
import { Application } from "../../../src/Application";
import errorTable from '../../../src/utils/error_table';

describe(SSHCommunication.name, () => {
    let ssh: SSHCommunication;
    let app: Application;

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

    describe('Disabled from configuration',()=>{
        beforeEach(()=>{
            app = testSuite.app;
            app.config.set('firewall_communication.ssh_enable',false);
        });

        it('install a firewall policy and communication is disabled, it should throw an error', async () => {
            await ssh.installFirewallPolicy("").catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });

        it('install OpenVPN server configs and communication is disabled, it should throw an error',async () => {
            await ssh.installOpenVPNServerConfigs("",[]).catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });

        it('install OpenVPN client configs and communication is disabled, it should throw an error',async () => {
            await ssh.installOpenVPNClientConfigs("",[]).catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });

        it('unistall OpenVPN configs and communication is disabled, it should throw an error',async () => {
            await ssh.uninstallOpenVPNConfigs("",[])
            .then(res => {
                expect(res).not.to.be.undefined;
            })
            .catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });
        
        it('get firewalls interfaces and communication is disabled, it should throw an error',async ()=>{
            await ssh.getFirewallInterfaces().catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });

        it('get firewalls IP tables and communication is disabled, it should throw an error',async () => {
            await ssh.getFirewallIptablesSave().catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });

        it('get CCD hash list and communication is disabled, it should throw an error', async () => {
            await ssh.ccdHashList("").catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE)
                }
            )
        });

        it('get real time status and communication is disabled, it should throw an error', async () => {
            await ssh.getRealtimeStatus("").catch(
                error => {
                    expect(error).equal(errorTable.SSH_COMMUNICATION_DISABLE);
                }
            )
        });
    })
});