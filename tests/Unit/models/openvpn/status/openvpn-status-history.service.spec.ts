import { getRepository } from "typeorm";
import { OpenVPNStatusHistory } from "../../../../../src/models/vpn/openvpn/status/openvpn-status-history";
import { CreateOpenVPNStatusHistoryData, FindResponse, GraphDataResponse, OpenVPNStatusHistoryService } from "../../../../../src/models/vpn/openvpn/status/openvpn-status-history.service";
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
            const previous: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, data);
            const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, [{
                timestamp: 2,
                name: 'other-name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date
            }]);

            const shouldDisconnect: OpenVPNStatusHistory = await getRepository(OpenVPNStatusHistory).findOneOrFail(previous[0].id);
            expect(persisted).to.have.length(1);
            expect(shouldDisconnect.disconnectedAt).not.to.be.null;

            
        });

        it('should disconnect a name if data is empty', async () => {
            const previous: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, data);
            const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, []);

            const shouldDisconnect: OpenVPNStatusHistory = await getRepository(OpenVPNStatusHistory).findOneOrFail(previous[0].id);
            
            expect(persisted).to.have.length(0);
            expect(shouldDisconnect.disconnectedAt).not.to.be.null;
        });
    });

    describe("history", () => {
        let records: OpenVPNStatusHistory[];
        const date: Date = new Date();
        date.setMilliseconds(0);
        beforeEach(async () => {
            records = await service.create(fwcProduct.openvpnServer.id, [{
                timestamp: 10,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date
            }]);
        });

        it('should return the record', async () => {
            const results: FindResponse = await service.history(fwcProduct.openvpnServer.id);

            expect(results).to.have.property("name");
            expect(results["name"].connections).to.have.length(1);
            expect(results["name"].connections[0].connected_at).to.deep.eq(records[0].connectedAt);
            expect(results["name"].connections[0].disconnected_at).to.be.null;
            expect(results["name"].connections[0].address).to.eq(records[0].address);
            expect(results["name"].connections[0].bytesSent).to.eq(records[0].bytesSent);
            expect(results["name"].connections[0].bytesReceived).to.eq(records[0].bytesReceived);
        });

        describe('filter: name', () => {
            it('should return record with the same name', async () => {
                const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
                    name: records[0].name
                });

                expect(results).to.have.property("name");
            });

            it('should ignore records which name is not equal', async () => {
                const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
                    name: 'test'
                });

                expect(results).to.not.have.property("name");
            })
        });

        describe('filter: timestamp range', () => {
            it('should return record within the timestamp range', async () => {
                const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
                    rangeTimestamp: [8, 12]
                });

                expect(results).to.have.property("name");
            });

            it('should ignore records not within timestamp range', async () => {
                const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
                    rangeTimestamp: [1, 9]
                });

                expect(results).to.not.have.property("name");
            })
        });

        describe('filter: address', () => {
            it('should return records which uses the address provided', async () => {
                const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
                    address: records[0].address
                });

                expect(results).to.have.property("name");
            });

            it('should return records which does not use the address provided', async () => {
                const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
                    address: '0.0.0.0'
                });

                expect(results).to.not.have.property("name");
            })
        })

    });

    describe("graph", () => {
        let records: OpenVPNStatusHistory[];
        const date: Date = new Date();
        date.setMilliseconds(0);
        beforeEach(async () => {
            records = await service.create(fwcProduct.openvpnServer.id, [{
                timestamp: 10,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date
            }]);
        });

        it('should return the record', async () => {
            const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id);

            expect(results).to.have.length(1);
            expect(results[0]).to.deep.eq({
                timestamp: 10,
                bytesReceived: 100,
                bytesSent: 200,
                bytesReceivedSpeed: null,
                bytesSentSpeed: null,
            })
        });

        it('should add values when there are multiple results for the same timestamp', async () => {
            await service.create(fwcProduct.openvpnServer.id, [{
                timestamp: 10,
                name: 'name',
                address: '1.1.1.1',
                bytesReceived: 100,
                bytesSent: 200,
                connectedAt: date
            }]);

            const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id);

            expect(results[0]).to.deep.eq({
                timestamp: 10,
                bytesReceived: 200,
                bytesSent: 400,
                bytesReceivedSpeed: null,
                bytesSentSpeed: null,
            })
        })

        describe('filter: name', () => {
            it('should return record with the same name', async () => {
                const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
                    name: records[0].name
                });

                expect(results).to.have.length(1);
            });

            it('should ignore records which name is not equal', async () => {
                const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
                    name: 'test'
                });

                expect(results).to.have.length(0);
            })
        });

        describe('filter: timestamp range', () => {
            it('should return record within the timestamp range', async () => {
                const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
                    rangeTimestamp: [8, 12]
                });

                expect(results).to.have.length(1);
            });

            it('should ignore records not within timestamp range', async () => {
                const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
                    rangeTimestamp: [1, 9]
                });

                expect(results).to.have.length(0);
            })
        });

        describe('filter: address', () => {
            it('should return records which uses the address provided', async () => {
                const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
                    address: records[0].address
                });

                expect(results).to.have.length(1);
            });

            it('should return records which does not use the address provided', async () => {
                const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
                    address: '0.0.0.0'
                });

                expect(results).to.have.length(0);
            })
        })

    });
})