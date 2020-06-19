import { describeName, playgroundPath, expect } from "../../../../mocha/global-setup";
import { Application } from "../../../../../src/Application";
import request = require("supertest");

import { testSuite } from "../../../../mocha/global-setup";
import { BackupService } from "../../../../../src/backups/backup.service";
import { createUser, generateSession, attachSession } from "../../../../utils/utils";
import { User } from "../../../../../src/models/user/User";
import { _URL } from "../../../../../src/fonaments/http/router/router.service";
import { Firewall } from "../../../../../src/models/firewall/Firewall";
import { OpenVPN } from "../../../../../src/models/vpn/openvpn/OpenVPN";
import { FwCloud } from "../../../../../src/models/fwcloud/FwCloud";
import { getRepository } from "typeorm";
import StringHelper from "../../../../../src/utils/string.helper";
import { Crt } from "../../../../../src/models/vpn/pki/Crt";
import { Ca } from "../../../../../src/models/vpn/pki/Ca";
import sinon from "sinon";
import { OpenVPNService } from "../../../../../src/models/vpn/openvpn/openvpn.service";
import path = require("path");
import * as fs from "fs-extra";
import { FSHelper } from "../../../../../src/utils/fs-helper";
import * as uuid from "uuid";
import { OpenVPNController } from "../../../../../src/controllers/firewalls/openvpn/openvpn.controller";

describe.only(describeName('OpenVPN E2E Tests'), () => {
    let app: Application;
    let backupService: BackupService;
    let loggedUser: User;
    let loggedUserSessionId: string;
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let openvpn: OpenVPN;

    let stubGenerateInstaller: sinon.SinonStub;

    let mockExePath: string;

    beforeEach(async () => {
        app = testSuite.app;
        backupService = await app.getService<BackupService>(BackupService.name);
        
        loggedUser = await createUser({role: 0});
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({role: 1});
        adminUserSessionId = generateSession(adminUser);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: StringHelper.randomize(10)
        }));

        firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
            name: StringHelper.randomize(10),
            fwCloudId: fwCloud.id
        }));

        openvpn = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
            firewallId: firewall.id,
            crt: await getRepository(Crt).save(getRepository(Crt).create({
                cn: StringHelper.randomize(10),
                days: 100,
                type: 0,
                ca: await getRepository(Ca).save(getRepository(Ca).create({
                    fwCloud: fwCloud,
                    cn: StringHelper.randomize(10),
                    days: 100,
                }))
            }))
        }));

        mockExePath = path.join(playgroundPath, 'openvpn.exe');
        fs.writeFileSync(mockExePath, "test");
        stubGenerateInstaller = sinon.stub(OpenVPNService.prototype, 'generateInstaller').returns(new Promise<string>((resolve) => { resolve(mockExePath);}))
    });

    afterEach(() => {
        stubGenerateInstaller.restore();
    })

    describe('OpenVPNController', () => {
        describe('BackupController@installer', () => {

            it('guest user should not generate an installer', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id 
                    }))
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not generate an installer', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should generate an installer', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(201)
            });

            it('admin user should generate an installer', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
            });

            it('should return the openvpn installer', async () => {
                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect('Content-Type', /application/)
                    .expect(201)
            });

            it('should copy the file to a temporary directory', async () => {
                const outputPath: string = path.join(playgroundPath, "uuid", "installer.exe");
                // @ts-ignore
                const tmpPathStub: sinon.SinonStub = sinon.stub(OpenVPNController.prototype, 'generateTemporaryPath')
                    .returns(outputPath as any);

                await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect('Content-Type', /application/)
                    .expect(201)
                    .then(() => {
                        expect(FSHelper.fileExistsSync(outputPath)).to.be.true;
                    })

                tmpPathStub.restore();
            });

            it('should return 404 if the openvpn does not belongs to the fwcloud', async () => {
                const otherFwCloud: FwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
                    name: StringHelper.randomize(10)
                }));
        
                const otherFirewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                    name: StringHelper.randomize(10),
                    fwCloudId: otherFwCloud.id
                }));

                return await request(app.express)
                    .get(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: otherFwCloud.id,
                        firewall: otherFirewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(404)
            });
        });
    })
})