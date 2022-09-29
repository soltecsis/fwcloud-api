import request = require("supertest");
import { getRepository } from "typeorm";
import { EventEmitter } from "typeorm/platform/PlatformTools";
import { Application } from "../../../src/Application";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { Firewall, FirewallInstallCommunication } from "../../../src/models/firewall/Firewall";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { User } from "../../../src/models/user/User";
import { Channel } from "../../../src/sockets/channels/channel";
import StringHelper from "../../../src/utils/string.helper";
import { describeName, testSuite } from "../../mocha/global-setup";
import { attachSession, createUser, generateSession } from "../../utils/utils";
import * as openpgp from 'openpgp';

describe.only(describeName('Communication E2E test'),()=>{
    let app: Application;
    
    let loggedUser: User;
    let loggedUserSessionId: string;
    
    let adminUser: User;
    let adminUserSessionId: string;
    
    let fwCloud: FwCloud;
    let firewall: Firewall;

    let channel_id: string;

    beforeEach(async () => {
        app = testSuite.app;
        
        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({name: StringHelper.randomize(10)}));
        
        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        channel_id = StringHelper.randomize(10)
    })
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
})