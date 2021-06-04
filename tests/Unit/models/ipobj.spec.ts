import { getRepository } from "typeorm";
import db from "../../../src/database/database-manager";
import { IPObj } from "../../../src/models/ipobj/IPObj";
import { Route } from "../../../src/models/routing/route/route.model";
import { RouteService } from "../../../src/models/routing/route/route.service";
import { RoutingTableService } from "../../../src/models/routing/routing-table/routing-table.service";
import { expect, testSuite } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(IPObj.name, () => {
    let fwcloudProduct: FwCloudProduct;
    let route: Route;
    let ipobj: IPObj;

    let routeService: RouteService;
    let routingTableService: RoutingTableService;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingTableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);

        ipobj = await getRepository(IPObj).save(getRepository(IPObj).create({
            name: 'gateway',
            address: '1.2.3.4',
            ipObjTypeId: 5,
            interfaceId: null,
            fwCloudId: fwcloudProduct.fwcloud.id
        }));

        route = await routeService.create({
            routingTableId: fwcloudProduct.routingTable.id,
            gatewayId:ipobj.id,
        })

        route = await routeService.update(route.id, {
            ipObjIds: [ipobj.id]
        })
    });

    describe('searchIpobjUsage', () => {
        it('should include routes associated', async () => {
            const whereUsed: any = await IPObj.searchIpobjUsage(db.getQuery(), fwcloudProduct.fwcloud.id, ipobj.id, 5);

            expect(whereUsed.restrictions.IpobjInRoutingRule).to.have.length(1);
            expect(whereUsed.restrictions.IpobjInRoutingRule[0].id).to.be.eq(route.id);
            
            expect(whereUsed.restrictions.AddrInRoutingRule).to.have.length(1);
            expect(whereUsed.restrictions.AddrInRoutingRule[0].id).to.be.eq(route.id)
        })
    })
})