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
        let data: CreateOpenVPNStatusHistoryData;
        let date: Date = new Date(new Date().setMilliseconds(0));

        beforeEach(() => {
            data = {
                timestamp: 1,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date,
                openVPNServerId: fwcProduct.openvpnServer.id
            }
        });

        it('should save a record', async () => {
            await service.create(data);

            const persisted: OpenVPNStatusHistory = await getRepository(OpenVPNStatusHistory).createQueryBuilder('history').getOneOrFail();

            expect(persisted.name).to.eq(data.name);
            expect(persisted.timestamp).to.eq(data.timestamp);
            expect(persisted.address).to.eq(data.address);
            expect(persisted.bytesReceived).to.eq(data.bytesReceived);
            expect(persisted.bytesSent).to.eq(data.bytesSent);
            expect(persisted.connectedAt.toISOString()).to.eq(data.connectedAt.toISOString());
            expect(persisted.openVPNServerId).to.eq(data.openVPNServerId);
        });

        it('should return the record', async () => {
            const persisted: OpenVPNStatusHistory = await service.create(data);

            expect(persisted.name).to.eq(data.name);
            expect(persisted.timestamp).to.eq(data.timestamp);
            expect(persisted.address).to.eq(data.address);
            expect(persisted.bytesReceived).to.eq(data.bytesReceived);
            expect(persisted.bytesSent).to.eq(data.bytesSent);
            expect(persisted.connectedAt.toISOString()).to.eq(data.connectedAt.toISOString());
            expect(persisted.openVPNServerId).to.eq(data.openVPNServerId);
        })
    });

    describe("find", () => {
        let record1: OpenVPNStatusHistory;

        beforeEach(async () => {
            record1 = await service.create({
                timestamp: 10,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: new Date(),
                openVPNServerId: fwcProduct.openvpnServer.id
            });
        });

        it('should return the record', async () => {
            const results: OpenVPNStatusHistory[] = await service.find();

            expect(results).to.have.length(1);
            expect(results[0].id).to.eq(record1.id);
        });

        describe('filter: name', () => {
            it('should return record with the same name', async () => {
                const results: OpenVPNStatusHistory[] = await service.find({
                    name: record1.name
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(record1.id);
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
                expect(results[0].id).to.eq(record1.id);
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
                    openVPNServerId: record1.openVPNServerId
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(record1.id);
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
                    address: record1.address
                });

                expect(results).to.have.length(1);
                expect(results[0].id).to.eq(record1.id);
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