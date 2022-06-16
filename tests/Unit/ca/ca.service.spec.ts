import { describeName, testSuite, expect } from './../../mocha/global-setup';
import { FwCloud } from './../../../src/models/fwcloud/FwCloud';
import { Application } from '../../../src/Application';
import { CaService } from '../../../src/ca/ca.service';
import { Ca } from '../../../src/models/vpn/pki/Ca';
import { beforeEach } from 'mocha';
import { getRepository } from 'typeorm';
import StringHelper from '../../../src/utils/string.helper';

describe(describeName('Ca Service Unit Test'), () =>{
    let app: Application;
    let service: CaService;
    let fwCloud: FwCloud;
    let ca: Ca;
    let changeComment: string;

    beforeEach(async ()=>{
        app = testSuite.app;
        fwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
            name: 'fwcloudTest'
        }));
        ca = await getRepository(Ca).save(getRepository(Ca).create({
            fwCloudId: fwCloud.id,
            cn: 'caTest',
            days: 1000,
            comment: 'testcomment'
        }));
        service = await app.getService<CaService>(CaService.name);

        changeComment = StringHelper.randomize(10)
    })

    describe('update()', () => {

        it('should update the comment of ca', async ()=>{

            await service.update(ca.id, {comment:changeComment});

            ca = await getRepository(Ca).findOne(ca.id);

            expect(await ca.comment).to.be.equal(changeComment);
        })
        it('should return updated ca', async () => {

            ca = await service.update(ca.id, {comment: changeComment});

            expect(ca.comment).to.be.equal(changeComment);
        })

    })
})