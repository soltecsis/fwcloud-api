import { getRepository } from "typeorm";
import { IPObjGroup } from "../../../src/models/ipobj/IPObjGroup";
import { Route } from "../../../src/models/routing/route/route.model";
import { RouteService } from "../../../src/models/routing/route/route.service";
import { RoutingTableService } from "../../../src/models/routing/routing-table/routing-table.service";
import { expect, testSuite } from "../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../utils/fwcloud-factory";

describe(IPObjGroup.name, () => {
    let fwcloudProduct: FwCloudProduct;
    let route: Route;
    let ipobjGroup: IPObjGroup;

    let routeService: RouteService;
    let routingTableService: RoutingTableService;

    beforeEach(async () => {
        fwcloudProduct = await (new FwCloudFactory()).make();
        routeService = await testSuite.app.getService<RouteService>(RouteService.name);
        routingTableService = await testSuite.app.getService<RoutingTableService>(RoutingTableService.name);

        ipobjGroup = await getRepository(IPObjGroup).save(getRepository(IPObjGroup).create({
            name: 'ipobjs group',
            type: 20,
            fwCloudId: fwcloudProduct.fwcloud.id
        }));

        route = await routeService.create({
            routingTableId: fwcloudProduct.routingTable.id,
            gatewayId: fwcloudProduct.ipobjs.get('gateway').id
        })

        route = await routeService.update(route.id, {
            ipObjGroupIds: [ipobjGroup.id]
        })
    });

    describe('searchIpobjUsage', () => {
        it('should include routes associated', async () => {
            const whereUsed: any = await IPObjGroup.searchGroupUsage(ipobjGroup.id, fwcloudProduct.fwcloud.id);

            expect(whereUsed.restrictions.GroupInRoute).to.have.length(1);
            expect(whereUsed.restrictions.GroupInRoute[0].id).to.be.eq(route.id)
        })
    })
})