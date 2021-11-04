import { describeName, playgroundPath, expect } from "../../../../mocha/global-setup";
import { Application } from "../../../../../src/Application";
import request = require("supertest");

import { testSuite } from "../../../../mocha/global-setup";
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
import path = require("path");
import * as fs from "fs-extra";
import { InstallerGenerator } from "../../../../../src/openvpn-installer/installer-generator";

describe(describeName('OpenVPN E2E Tests'), () => {
    let app: Application;
    let loggedUser: User;
    let loggedUserSessionId: string;
    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let firewall: Firewall;
    let openvpn: OpenVPN;
    let serverOpenVPN: OpenVPN;

    let stubGenerateInstaller: sinon.SinonStub;
    let stubOpenVPNDumpConfig: sinon.SinonStub;

    let mockExePath: string;

    let connectioName: string = "test";

    beforeEach(async () => {
        app = testSuite.app;
        
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

        serverOpenVPN = await getRepository(OpenVPN).save(getRepository(OpenVPN).create({
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
            })),
            parentId: serverOpenVPN.id
        }));

        mockExePath = path.join(playgroundPath, 'vpn', 'fwcloud-vpn.exe');

        // @ts-ignore
        stubGenerateInstaller = sinon.stub(InstallerGenerator.prototype, 'generate').callsFake(() => {
            fs.mkdirpSync(path.dirname(mockExePath));
            fs.writeFileSync(mockExePath, "")
            return mockExePath;
        });

        stubOpenVPNDumpConfig = sinon.stub(OpenVPN, 'dumpCfg').returns(new Promise<string>(resolve => resolve('<test></test>')));
    });

    afterEach(() => {
        stubGenerateInstaller.restore();
        stubOpenVPNDumpConfig.restore();
    })

    describe('OpenVPNController', () => {
        describe('OpenVPNController@installer', () => {

            it('guest user should not generate an installer', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id 
                    }))
                    .expect(401);
            });

            it('regular user which does not belong to the fwcloud should not generate an installer', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: connectioName
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(401)
            });

            it('regular user which belongs to the fwcloud should generate an installer', async () => {
                loggedUser.fwClouds = [fwCloud];
                await getRepository(User).save(loggedUser);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: connectioName
                    })
                    .set('Cookie', [attachSession(loggedUserSessionId)])
                    .expect(201)
            });

            it('admin user should generate an installer', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: connectioName
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(201)
            });

            it('should return the openvpn installer', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: connectioName
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect('Content-Type', /application/)
                    .expect(201)
            });

            it('should return 422 if the connection_name is not provided', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422)
            });

            it('should return 422 if the connection_name is not valid', async () => {
                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: "-" + connectioName
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(422)
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
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: otherFwCloud.id,
                        firewall: otherFirewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: connectioName
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(404)
            });

            it('should return 404 if the openvpn is a server', async () => {
                openvpn.parentId = null;
                await getRepository(OpenVPN).save(openvpn);

                return await request(app.express)
                    .post(_URL().getURL('fwclouds.firewalls.openvpns.installer', {
                        fwcloud: fwCloud.id,
                        firewall: firewall.id,
                        openvpn: openvpn.id
                    }))
                    .send({
                        connection_name: connectioName
                    })
                    .set('Cookie', [attachSession(adminUserSessionId)])
                    .expect(404)
            });
        });
    })
})