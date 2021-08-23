import { getRepository, QueryFailedError } from "typeorm";
import { Application } from "../../../../src/Application";
import { Firewall } from "../../../../src/models/firewall/Firewall";
import StringHelper from "../../../../src/utils/string.helper";
import { expect, testSuite } from "../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../utils/fwcloud-factory";
import { Request } from 'express';
import { FwCloud } from "../../../../src/models/fwcloud/FwCloud";
import { RoutingGroupController } from "../../../../src/controllers/routing/routing-group/routing-group.controller";
import { RoutingGroup } from "../../../../src/models/routing/routing-group/routing-group.model";

describe(RoutingGroupController.name, () => {
    let controller: RoutingGroupController;
    let app: Application;
    let fwcProduct: FwCloudProduct;
    
    let fwcloud: FwCloud;
    let firewall: Firewall;
    let routingGroup: RoutingGroup;

    beforeEach(async () => {
        app = testSuite.app;
        
        fwcProduct = await (new FwCloudFactory()).make();
        
        fwcloud = fwcProduct.fwcloud;
        firewall = fwcProduct.firewall;
        routingGroup = getRepository(RoutingGroup).create({
            name: '',
            firewallId: firewall.id
        })
        controller = new RoutingGroupController(app);
    });

    describe('make', () => {
        it('should not throw error if the route belongs to the firewall which belongs to the fwcloud', async () => {
            expect(await controller.make({
                params: {
                    fwcloud: fwcProduct.fwcloud.id,
                    firewall: firewall.id,
                    routingGroup: routingGroup.id
                }
            } as unknown as Request)).to.be.undefined;
        });

        it('should throw error if the route blongs to other firewall', async () => {
            const newFirewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                name: StringHelper.randomize(10),
                fwCloudId: fwcProduct.fwcloud.id
            }));

            routingGroup = await getRepository(RoutingGroup).save({
                firewallId: newFirewall.id,
                name: 'group'
            })

            expect(controller.make({
                params: {
                    fwcloud: fwcProduct.fwcloud.id,
                    firewall: firewall.id,
                    routingGroup: routingGroup.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the firewall blongs to other fwcloud', async () => {
            const newFwcloud: FwCloud = await getRepository(FwCloud).save(getRepository(FwCloud).create({
                name: StringHelper.randomize(10)
            }));

            const newFirewall: Firewall = await getRepository(Firewall).save(getRepository(Firewall).create({
                name: StringHelper.randomize(10),
                fwCloudId: newFwcloud.id
            }));

            
            expect(controller.make({
                params: {
                    fwcloud: fwcProduct.fwcloud.id,
                    firewall: newFirewall.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the fwcloud does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: -1,
                    firewall: firewall.id,
                    routingGroup: routingGroup.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the firewall does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: fwcProduct.fwcloud.id,
                    firewall: -1,
                    routingGroup: routingGroup.id
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });

        it('should throw error if the table does not exist', async () => {
            expect(controller.make({
                params: {
                    fwcloud: fwcProduct.fwcloud.id,
                    firewall: firewall.id,
                    routingGroup: -1
                }
            } as unknown as Request)).rejectedWith(QueryFailedError);
        });
    })
})