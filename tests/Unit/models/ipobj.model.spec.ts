import { getRepository } from "typeorm";
import db from "../../../src/database/database-manager";
import { IPObj } from "../../../src/models/ipobj/IPObj";
import { expect } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(IPObj.name, () => {
    let fwcloudProduct: FwCloudProduct;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
    });

    describe('searchIpobjUsage', () => {
        describe('route', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, fwcloudProduct.ipobjs.get('address').id, 5);
    
                expect(whereUsed.restrictions.IpobjInRoute).to.have.length(1);
                expect(whereUsed.restrictions.IpobjInRoute[0].id).to.be.eq(fwcloudProduct.routes.get('route1').id);
            });

            it('should detect address usages', async () => {
                await getRepository(IPObj).delete({id: fwcloudProduct.ipobjs.get('host-eth3-addr1').id})
                await getRepository(IPObj).delete({id: fwcloudProduct.ipobjs.get('host-eth3-addr2').id})
                const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, fwcloudProduct.ipobjs.get('host-eth2-addr1').id, 5);
            
                expect(whereUsed.restrictions.LastAddrInHostInRoute).to.have.length(1);
                expect(whereUsed.restrictions.LastAddrInHostInRoute[0].id).to.be.eq(fwcloudProduct.routes.get('route1').id);
            })
        });

        describe('routingRule', () => {
            it('should detect usages', async () => {
                const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, fwcloudProduct.ipobjs.get('address').id, 5);
    
                expect(whereUsed.restrictions.IpobjInRoutingRule).to.have.length(1);
                expect(whereUsed.restrictions.IpobjInRoutingRule[0].id).to.be.eq(fwcloudProduct.routingRules.get('routing-rule-1').id);
            })

            it('should detect address usages', async () => {
                await getRepository(IPObj).delete({id: fwcloudProduct.ipobjs.get('host-eth3-addr1').id})
                await getRepository(IPObj).delete({id: fwcloudProduct.ipobjs.get('host-eth3-addr2').id})
                const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, fwcloudProduct.ipobjs.get('host-eth2-addr1').id, 5);
            
                expect(whereUsed.restrictions.LastAddrInHostInRoutingRule).to.have.length(1);
                expect(whereUsed.restrictions.LastAddrInHostInRoutingRule[0].id).to.be.eq(fwcloudProduct.routingRules.get('routing-rule-1').id);
            })
        });
    })
})