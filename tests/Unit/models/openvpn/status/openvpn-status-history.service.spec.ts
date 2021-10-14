import { getRepository } from "typeorm";
import { OpenVPNStatusHistory } from "../../../../../src/models/vpn/openvpn/status/openvpn-status-history";
import { CreateOpenVPNStatusHistoryData, OpenVPNStatusHistoryService } from "../../../../../src/models/vpn/openvpn/status/openvpn-status-history.service";
import { describeName, expect, testSuite } from "../../../../mocha/global-setup";
import { FwCloudFactory, FwCloudProduct } from "../../../../utils/fwcloud-factory";

describe(describeName(OpenVPNStatusHistoryService.name + " Unit Tests"), () => {
    let fwcProduct: FwCloudProduct;
    let service: OpenVPNStatusHistoryService;

    beforeEach(async () => {
        await testSuite.resetDatabaseData();
        fwcProduct = await new FwCloudFactory().make();
        service = await testSuite.app.getService<OpenVPNStatusHistoryService>(OpenVPNStatusHistoryService.name);
    });

    describe("create", () => {
        let data: CreateOpenVPNStatusHistoryData[];
        let date: Date = new Date(new Date().setMilliseconds(0));

        beforeEach(() => {
            data = [{
                timestamp: 1,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date
            }];
        });

        it('should save a record', async () => {
            await service.create(fwcProduct.openvpnServer.id, data);

            const persisted: OpenVPNStatusHistory = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history').getOneOrFail();
            expect(persisted.name).to.eq(data[0].name);
            expect(persisted.timestamp).to.eq(data[0].timestamp);
            expect(persisted.address).to.eq(data[0].address);
            expect(persisted.bytesReceived).to.eq(data[0].bytesReceived);
            expect(persisted.bytesSent).to.eq(data[0].bytesSent);
            expect(persisted.connectedAt.toISOString()).to.eq(data[0].connectedAt.toISOString());
            expect(persisted.openVPNServerId).to.eq(fwcProduct.openvpnServer.id);
        });

        it('should return the record', async () => {
            const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, data);

            expect(persisted[0].name).to.eq(data[0].name);
            expect(persisted[0].timestamp).to.eq(data[0].timestamp);
            expect(persisted[0].address).to.eq(data[0].address);
            expect(persisted[0].bytesReceived).to.eq(data[0].bytesReceived);
            expect(persisted[0].bytesSent).to.eq(data[0].bytesSent);
            expect(persisted[0].connectedAt.toISOString()).to.eq(data[0].connectedAt.toISOString());
            expect(persisted[0].openVPNServerId).to.eq(fwcProduct.openvpnServer.id);
        });

        it('should disconnect a name if it is not present', async () => {
            await service.create(fwcProduct.openvpnServer.id, data);
            const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, [{
                timestamp: 2,
                name: 'other-name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date
            }]);

            expect(persisted).to.have.length(2);
            expect(persisted[1].name).to.eq(data[0].name);
            expect(persisted[1].address).to.eq(data[0].address);
            expect(persisted[1].bytesReceived).to.eq(data[0].bytesReceived);
            expect(persisted[1].bytesSent).to.eq(data[0].bytesSent);
            expect(persisted[1].connectedAt.toISOString()).to.eq(data[0].connectedAt.toISOString());
            expect(persisted[1].disconnectedAt).not.to.be.null;
        });

        it('should disconnect a name if data is empty', async () => {
            await service.create(fwcProduct.openvpnServer.id, data);
            const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, []);

            expect(persisted).to.have.length(1);
            expect(persisted[0].name).to.eq(data[0].name);
            expect(persisted[0].address).to.eq(data[0].address);
            expect(persisted[0].bytesReceived).to.eq(data[0].bytesReceived);
            expect(persisted[0].bytesSent).to.eq(data[0].bytesSent);
            expect(persisted[0].connectedAt.toISOString()).to.eq(data[0].connectedAt.toISOString());
            expect(persisted[0].disconnectedAt).not.to.be.null;
        });
    });

    describe("find", () => {
        let records: OpenVPNStatusHistory[];

        beforeEach(async () => {
            records = await service.create(fwcProduct.openvpnServer.id, [{
                timestamp: 10,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: new Date()
            }]);
        });

        it('should return the record', async () => {
            const results: OpenVPNStatusHistory[] = await service.find();

            expect(results).to.have.length(1);
            expect(results[0].id).to.eq(records[0].id);
        });

        describe('filter: name', () => {
            it('should return record with the same name', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    name: records[0].name
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(records[0].id);
            });

            it('should ignore records which name is not equal', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    name: 'test'
                });

                expect(results).to.have.length(0);
            })
        });

        describe('filter: timestamp range', () => {
            it('should return record within the timestamp range', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    rangeTimestamp: [8, 12]
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(records[0].id);
            });

            it('should ignore records not within timestamp range', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    rangeTimestamp: [1, 9]
                });

                expect(results).to.have.length(0);
            })
        });

        describe('filter: openvpn server', () => {
            it('should return records belongs to openvpn server', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    openVPNServerId: records[0].openVPNServerId
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(records[0].id);
            });

            it('should ignore records which does not belong to openvpn server', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    openVPNServerId: -1
                });

                expect(results).to.have.length(0);
            })
        })

        describe('filter: address', () => {
            it('should return records which uses the address provided', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    address: records[0].address
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(records[0].id);
            });

            it('should return records which does not use the address provided', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    address: '0.0.0.0'
                });

                expect(results).to.have.length(0);
            })
        })

    });
})