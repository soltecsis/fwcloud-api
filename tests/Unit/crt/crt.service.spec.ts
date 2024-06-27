import { describeName, testSuite, expect } from './../../mocha/global-setup';
import { FwCloud } from './../../../src/models/fwcloud/FwCloud';
import { Application } from '../../../src/Application';
import { beforeEach } from 'mocha';
import StringHelper from '../../../src/utils/string.helper';
import { CrtService } from '../../../src/crt/crt.service';
import { Crt } from '../../../src/models/vpn/pki/Crt';
import { Ca } from '../../../src/models/vpn/pki/Ca';
import { EntityManager } from 'typeorm';
import db from '../../../src/database/database-manager';

describe(describeName('Crt Service Unit Test'), () =>{
    let app: Application;
    let service: CrtService;
    let fwCloud: FwCloud;
    let crt: Crt;
    let ca: Ca;
    let changeComment: string;
    let manager: EntityManager

    beforeEach(async ()=>{
        app = testSuite.app;
        manager = db.getSource().manager;
        fwCloud = await manager.getRepository(FwCloud).save(manager.getRepository(FwCloud).create({
            name: 'fwcloudTest'
        }));
        ca = await manager.getRepository(Ca).save(manager.getRepository(Ca).create({
            fwCloudId: fwCloud.id,
            cn: 'caTest',
            days: 1000,
            comment: 'testcomment'
        }));
        crt = await manager.getRepository(Crt).save(manager.getRepository(Crt).create({
            caId: ca.id,
            cn: 'crtTtest',
            days: 1000,
            type: 1,
            comment: 'testComment'
        }))
        service = await app.getService<CrtService>(CrtService.name);

        changeComment = StringHelper.randomize(10)
    })

    describe('update()', () => {

        it('should update the comment of crt', async ()=>{

            await service.update(crt.id, {comment:changeComment});

            crt = await manager.getRepository(Crt).findOne({ where: { id: crt.id }});

            expect(await crt.comment).to.be.equal(changeComment);
        })
        it('should return updated crt', async () => {

            crt = await service.update(crt.id, {comment: changeComment});

            expect(crt.comment).to.be.equal(changeComment);
        })

    })
})