import { EntityManager } from 'typeorm';
import { OpenVPNStatusHistory } from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-history';
import {
  CreateOpenVPNStatusHistoryData,
  FindResponse,
  GraphDataResponse,
  OpenVPNStatusHistoryService,
  PaginatedFindResponse,
} from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-history.service';
import { describeName, expect, testSuite } from '../../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../../utils/fwcloud-factory';
import db from '../../../../../../src/database/database-manager';

describe(describeName(OpenVPNStatusHistoryService.name + ' Unit Tests'), () => {
  let fwcProduct: FwCloudProduct;
  let service: OpenVPNStatusHistoryService;
  let manager: EntityManager;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    service = await testSuite.app.getService<OpenVPNStatusHistoryService>(
      OpenVPNStatusHistoryService.name,
    );
  });

  describe('create', () => {
    let data: CreateOpenVPNStatusHistoryData[];

    beforeEach(() => {
      data = [
        {
          timestampInSeconds: 1,
          name: 'name',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        },
      ];
    });

    it('should save a record', async () => {
      await service.create(fwcProduct.openvpnServer.id, data);

      const persisted: OpenVPNStatusHistory = await manager
        .getRepository(OpenVPNStatusHistory)
        .createQueryBuilder('history')
        .getOneOrFail();
      expect(persisted.name).to.eq(data[0].name);
      expect(persisted.timestampInSeconds).to.eq(data[0].timestampInSeconds);
      expect(persisted.address).to.eq(data[0].address);
      expect(persisted.bytesReceived).to.eq(data[0].bytesReceived.toString());
      expect(persisted.bytesSent).to.eq(data[0].bytesSent.toString());
      expect(persisted.connectedAtTimestampInSeconds).to.eq(
        Math.floor(data[0].connectedAtTimestampInSeconds),
      );
      expect(persisted.openVPNServerId).to.eq(fwcProduct.openvpnServer.id);
    });

    it('should return the record', async () => {
      const persisted: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        data,
      );

      expect(persisted[0].name).to.eq(data[0].name);
      expect(persisted[0].timestampInSeconds).to.eq(data[0].timestampInSeconds);
      expect(persisted[0].address).to.eq(data[0].address);
      expect(persisted[0].bytesReceived).to.eq(data[0].bytesReceived.toString());
      expect(persisted[0].bytesSent).to.eq(data[0].bytesSent.toString());
      expect(persisted[0].connectedAtTimestampInSeconds).to.eq(
        data[0].connectedAtTimestampInSeconds,
      );
      expect(persisted[0].openVPNServerId).to.eq(fwcProduct.openvpnServer.id);
    });

    it('should disconnect a name if it is not present', async () => {
      const previous: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        data,
      );
      const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, [
        {
          timestampInSeconds: 2,
          name: 'other-name',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        },
      ]);

      const shouldDisconnect: OpenVPNStatusHistory = await manager
        .getRepository(OpenVPNStatusHistory)
        .findOneOrFail({ where: { id: previous[0].id } });
      expect(persisted).to.have.length(1);
      expect(shouldDisconnect.disconnectedAtTimestampInSeconds).not.to.be.null;
    });

    it('should disconnect a name if data is empty', async () => {
      const previous: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        data,
      );
      const persisted: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        [],
      );

      const shouldDisconnect: OpenVPNStatusHistory = await manager
        .getRepository(OpenVPNStatusHistory)
        .findOneOrFail({ where: { id: previous[0].id } });

      expect(persisted).to.have.length(0);
      expect(shouldDisconnect.disconnectedAtTimestampInSeconds).not.to.be.null;
    });

    it('should disconnect a name if address has changed', async () => {
      const previous: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        data,
      );
      const persisted: OpenVPNStatusHistory[] = await service.create(fwcProduct.openvpnServer.id, [
        {
          timestampInSeconds: 2,
          name: 'name',
          address: '1.1.1.2',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        },
      ]);

      const shouldDisconnect: OpenVPNStatusHistory = await manager
        .getRepository(OpenVPNStatusHistory)
        .findOneOrFail({ where: { id: previous[0].id } });

      expect(persisted).to.have.length(1);
      expect(shouldDisconnect.disconnectedAtTimestampInSeconds).not.to.be.null;
    });
  });

  describe('history', () => {
    let records: OpenVPNStatusHistory[];
    const date: Date = new Date();
    date.setMilliseconds(0);
    beforeEach(async () => {
      records = await service.create(fwcProduct.openvpnServer.id, [
        {
          timestampInSeconds: 10,
          name: 'name',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        },
      ]);
    });

    it('should return the connection list', async () => {
      const results: FindResponse = await service.history(fwcProduct.openvpnServer.id);

      expect(results).to.have.property('name');
      expect(results['name'].connections).to.have.length(1);
      expect(results['name'].connections[0].connected_at).to.deep.eq(
        new Date(records[0].connectedAtTimestampInSeconds * 1000),
      );
      expect(results['name'].connections[0].disconnected_at).to.be.null;
      expect(results['name'].connections[0].address).to.eq(records[0].address);
      expect(results['name'].connections[0].bytesSent).to.eq(parseInt(records[0].bytesSent));
      expect(results['name'].connections[0].bytesReceived).to.eq(
        parseInt(records[0].bytesReceived),
      );
    });

    it('should return bytes sent and recevied for each connection', async () => {
      const recordFirstConnections: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        [
          {
            timestampInSeconds: 11,
            name: 'test',
            address: '1.1.1.1',
            bytesReceived: 100,
            bytesSent: 200,
            connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
          },
        ],
      );

      //Close previous connection
      await service.create(fwcProduct.openvpnServer.id, []);

      const recordSecondConnections: OpenVPNStatusHistory[] = await service.create(
        fwcProduct.openvpnServer.id,
        [
          {
            timestampInSeconds: 12,
            name: 'test',
            address: '1.1.1.1',
            bytesReceived: 100,
            bytesSent: 200,
            connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
          },
        ],
      );

      const results: FindResponse = await service.history(fwcProduct.openvpnServer.id);

      expect(results['test'].connections).to.have.length(2);

      expect(results['test'].connections[0].connected_at).to.deep.eq(
        new Date(recordFirstConnections[0].connectedAtTimestampInSeconds * 1000),
      );
      expect(results['test'].connections[0].disconnected_at).to.deep.eq(
        new Date(new Date(recordFirstConnections[0].timestampInSeconds * 1000)),
      );
      expect(results['test'].connections[0].address).to.eq(recordFirstConnections[0].address);
      expect(results['test'].connections[0].bytesSent).to.eq(
        parseInt(recordFirstConnections[0].bytesSent),
      );
      expect(results['test'].connections[0].bytesReceived).to.eq(
        parseInt(recordFirstConnections[0].bytesReceived),
      );

      expect(results['test'].connections[1].connected_at).to.deep.eq(
        new Date(recordSecondConnections[0].connectedAtTimestampInSeconds * 1000),
      );
      expect(results['test'].connections[1].disconnected_at).to.be.null;
      expect(results['test'].connections[1].address).to.eq(recordSecondConnections[0].address);
      expect(results['test'].connections[1].bytesSent).to.eq(
        parseInt(recordSecondConnections[0].bytesSent),
      );
      expect(results['test'].connections[1].bytesReceived).to.eq(
        parseInt(recordSecondConnections[0].bytesReceived),
      );
    });

    describe('filter: name', () => {
      it('should return record with the same name', async () => {
        const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
          name: records[0].name,
        });

        expect(results).to.have.property('name');
      });

      it('should ignore records which name is not equal', async () => {
        const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
          name: 'test',
        });

        expect(results).to.not.have.property('name');
      });
    });

    describe('filter: timestamp range', () => {
      it('should return record within the timestamp range', async () => {
        const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(8000), new Date(12000)],
        });

        expect(results).to.have.property('name');
      });

      it('should ignore records not within timestamp range', async () => {
        const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(1000), new Date(9000)],
        });

        expect(results).to.not.have.property('name');
      });
    });

    describe('filter: address', () => {
      it('should return records which uses the address provided', async () => {
        const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
          address: records[0].address,
        });

        expect(results).to.have.property('name');
      });

      it('should return records which does not use the address provided', async () => {
        const results: FindResponse = await service.history(fwcProduct.openvpnServer.id, {
          address: '0.0.0.0',
        });

        expect(results).to.not.have.property('name');
      });
    });

    describe('pagination', () => {
      beforeEach(async () => {
        await manager.getRepository(OpenVPNStatusHistory).save([
          {
            timestampInSeconds: 100,
            name: 'Cli1',
            address: '10.0.0.1:1000',
            bytesReceived: '100',
            bytesSent: '200',
            connectedAtTimestampInSeconds: 90,
            openVPNServerId: fwcProduct.openvpnServer.id,
          },
          {
            timestampInSeconds: 101,
            name: 'Cli1',
            address: '10.0.0.1:1000',
            bytesReceived: '150',
            bytesSent: '250',
            connectedAtTimestampInSeconds: 90,
            openVPNServerId: fwcProduct.openvpnServer.id,
          },
          {
            timestampInSeconds: 102,
            name: 'Cli2',
            address: '10.0.0.2:1000',
            bytesReceived: '300',
            bytesSent: '400',
            connectedAtTimestampInSeconds: 92,
            disconnectedAtTimestampInSeconds: 102,
            openVPNServerId: fwcProduct.openvpnServer.id,
          },
          {
            timestampInSeconds: 103,
            name: 'Cli3',
            address: '10.0.0.3:1000',
            bytesReceived: '500',
            bytesSent: '600',
            connectedAtTimestampInSeconds: 93,
            openVPNServerId: fwcProduct.openvpnServer.id,
          },
        ]);
      });

      it('should return a paginated connection list without changing the legacy history format inside data', async () => {
        const results: PaginatedFindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(100000), new Date(103000)],
          page: 1,
          limit: 2,
          sort: 'cn',
          order: 'ASC',
        });

        expect(results.pagination).to.deep.eq({
          page: 1,
          limit: 2,
          total: 3,
        });
        expect(Object.keys(results.history)).to.deep.eq(['Cli1', 'Cli2']);
        expect(results.history['Cli1'].connections).to.have.length(1);
        expect(results.history['Cli1'].connections[0]).to.deep.eq({
          connected_at: new Date(90000),
          disconnected_at: null,
          bytesReceived: 150,
          bytesSent: 250,
          address: '10.0.0.1:1000',
        });
      });

      it('should apply offset using the requested page and limit', async () => {
        const results: PaginatedFindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(100000), new Date(103000)],
          page: 2,
          limit: 2,
          sort: 'cn',
          order: 'ASC',
        });

        expect(results.pagination).to.deep.eq({
          page: 2,
          limit: 2,
          total: 3,
        });
        expect(Object.keys(results.history)).to.deep.eq(['Cli3']);
      });

      it('should keep applying the current name filter before paginating', async () => {
        const results: PaginatedFindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(100000), new Date(103000)],
          name: 'Cli2',
          page: 1,
          limit: 50,
        });

        expect(results.pagination.total).to.eq(1);
        expect(Object.keys(results.history)).to.deep.eq(['Cli2']);
      });

      it('should keep applying the current address filter before paginating', async () => {
        const results: PaginatedFindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(100000), new Date(103000)],
          address: '10.0.0.3:1000',
          page: 1,
          limit: 50,
        });

        expect(results.pagination.total).to.eq(1);
        expect(Object.keys(results.history)).to.deep.eq(['Cli3']);
      });

      it('should sort paginated connections by the requested field', async () => {
        const results: PaginatedFindResponse = await service.history(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(100000), new Date(103000)],
          page: 1,
          limit: 2,
          sort: 'connected_at',
          order: 'DESC',
        });

        expect(Object.keys(results.history)).to.deep.eq(['Cli3', 'Cli2']);
      });
    });
  });

  describe('graph', () => {
    let records: OpenVPNStatusHistory[];
    const date: Date = new Date();
    date.setMilliseconds(0);
    beforeEach(async () => {
      records = await service.create(fwcProduct.openvpnServer.id, [
        {
          timestampInSeconds: 10,
          name: 'name',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        },
      ]);
    });

    it('should return the record', async () => {
      const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id);

      expect(results).to.have.length(1);
      expect(results[0]).to.deep.eq({
        timestamp: 10 * 1000,
        bytesReceived: 100,
        bytesSent: 200,
        bytesReceivedSpeed: null,
        bytesSentSpeed: null,
      });
    });

    it('should add values when there are multiple results for the same timestamp', async () => {
      await service.create(fwcProduct.openvpnServer.id, [
        {
          timestampInSeconds: 10,
          name: 'name',
          address: '1.1.1.1',
          bytesReceived: 100,
          bytesSent: 200,
          connectedAtTimestampInSeconds: parseInt((new Date().getTime() / 1000).toFixed(0)),
        },
      ]);

      const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id);

      expect(results[0]).to.deep.eq({
        timestamp: 10 * 1000,
        bytesReceived: 200,
        bytesSent: 400,
        bytesReceivedSpeed: null,
        bytesSentSpeed: null,
      });
    });

    describe('filter: name', () => {
      it('should return record with the same name', async () => {
        const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
          name: records[0].name,
        });

        expect(results).to.have.length(1);
      });

      it('should ignore records which name is not equal', async () => {
        const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
          name: 'test',
        });

        expect(results).to.have.length(0);
      });
    });

    describe('filter: timestamp range', () => {
      it('should return record within the timestamp range', async () => {
        const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(8000), new Date(12000)],
        });

        expect(results).to.have.length(1);
      });

      it('should ignore records not within timestamp range', async () => {
        const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
          rangeTimestamp: [new Date(1000), new Date(9000)],
        });

        expect(results).to.have.length(0);
      });
    });

    describe('filter: address', () => {
      it('should return records which uses the address provided', async () => {
        const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
          address: records[0].address,
        });

        expect(results).to.have.length(1);
      });

      it('should return records which does not use the address provided', async () => {
        const results: GraphDataResponse = await service.graph(fwcProduct.openvpnServer.id, {
          address: '0.0.0.0',
        });

        expect(results).to.have.length(0);
      });
    });
  });
});
