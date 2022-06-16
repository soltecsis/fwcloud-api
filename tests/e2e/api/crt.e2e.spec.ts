import { getRepository } from "typeorm";
import { Application } from "../../../src/Application";
import { FwCloud } from "../../../src/models/fwcloud/FwCloud";
import { User } from "../../../src/models/user/User";
import request = require("supertest");
import StringHelper from "../../../src/utils/string.helper";
import { describeName, expect, testSuite } from "../../mocha/global-setup";
import { attachSession, createUser, generateSession } from "../../utils/utils";
import { _URL } from "../../../src/fonaments/http/router/router.service";
import { Ca } from "../../../src/models/vpn/pki/Ca";
import { Crt } from "../../../src/models/vpn/pki/Crt";
import { CrtService } from "../../../src/crt/crt.service";


describe(describeName('Crt E2E Test'), () => {
    let app: Application;

    let loggedUser: User;
    let loggedUserSessionId: string;

    let adminUser: User;
    let adminUserSessionId: string;

    let fwCloud: FwCloud;
    let ca: Ca;
    let crt: Crt;
    let service : CrtService;

    beforeEach(async () => {
        app = testSuite.app;

        loggedUser = await createUser({ role: 0 });
        loggedUserSessionId = generateSession(loggedUser);

        adminUser = await createUser({ role: 1 });
        adminUserSessionId = generateSession(adminUser);

        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({name: StringHelper.randomize(10)}));
        ca = await getRepository(Ca).save(getRepository(Ca).create({
            fwCloudId: fwCloud.id,
            cn: StringHelper.randomize(10),
            days: 1000,
            comment: 'testComment'
        }))
        crt = await getRepository(Crt).save(getRepository(Crt).create({
            caId: ca.id,
            cn: 'crtTtest',
            days: 1000,
            type: 1,
            comment: 'testComment'
        }))
        service = await app.getService<CrtService>(CrtService.name)
    });

    describe('CrtController@update', ()=>{

        it('guest user should not update a comment of crt', async()=>{
            return await request(app.express)
            .put(_URL().getURL('fwclouds.cas.crts.update', {
                fwcloud: fwCloud.id, 
                ca: ca.id,
                crt: crt.id
            }))
            .expect(401)
        })
        it('regular user should not update a comment of crt if it does not belong to the fwcloud', async()=>{
            return await request(app.express)
            .put(_URL().getURL('fwclouds.cas.crts.update', {
                fwcloud: fwCloud.id, 
                ca: ca.id,
                crt: crt.id
            }))
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .expect(401)
        })
        it('regular user should update a comment of crt if it does belong to the fwcloud', async()=>{
            loggedUser.fwClouds = [fwCloud]
            await getRepository(User).save(loggedUser)

            return await request(app.express)
            .put(_URL().getURL('fwclouds.cas.crts.update', {
                fwcloud: fwCloud.id, 
                ca: ca.id,
                crt: crt.id
            }))
            .set('Cookie', [attachSession(loggedUserSessionId)])
            .expect(200)            
        })
        it('admin user should update a comment of crt', async()=>{
            return await request(app.express)
            .put(_URL().getURL('fwclouds.cas.crts.update', {
                fwcloud: fwCloud.id, 
                ca: ca.id,
                crt: crt.id
            }))
            .set('Cookie', [attachSession(adminUserSessionId)])
            .expect(200)
        })
        it('should update the comment of the crt', async ()=>{
            const comment: string = StringHelper.randomize(10);
            return await request(app.express)
            .put(_URL().getURL('fwclouds.cas.crts.update', {
                fwcloud: fwCloud.id, 
                ca: ca.id,
                crt: crt.id
            }))
            .set('Cookie', [attachSession(adminUserSessionId)])
            .send({
                comment: comment
            })
            .expect(200)
            .then(async (response)=>{
                const crtWithNewComment: Crt = await Crt.findOne(crt.id);
                expect(crtWithNewComment.comment).to.be.equal(comment)
            })

        })
        it('should return the updated crt', async () =>{
            const comment = StringHelper.randomize(10);
            return await request(app.express)
            .put(_URL().getURL('fwclouds.cas.crts.update', {
                fwcloud: fwCloud.id, 
                ca: ca.id,
                crt: crt.id
            }))
            .set('Cookie', [attachSession(adminUserSessionId)])
            .send({
                comment: comment
            })
            .expect(200)
            .then(async (response)=>{
                const crtWithNewComment = await Crt.findOne(crt.id);                
                expect(response.body.data.comment).to.be.equal(crtWithNewComment.comment)
            })
        })

    })



})