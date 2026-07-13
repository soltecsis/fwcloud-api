import { EntityManager } from 'typeorm';
import sinon from 'sinon';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../../../../src/models/firewall/Firewall';
import { OpenVPNStatusSamplingService } from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-sampling.service';
import { OpenVPNOption } from '../../../../../../src/models/vpn/openvpn/openvpn-option.model';
import { OpenVPN } from '../../../../../../src/models/vpn/openvpn/OpenVPN';
import db from '../../../../../../src/database/database-manager';
import { describeName, expect, testSuite } from '../../../../../mocha/global-setup';
import { FwCloudFactory, FwCloudProduct } from '../../../../../utils/fwcloud-factory';

describe(describeName(OpenVPNStatusSamplingService.name + ' Unit Tests'), () => {
  let fwcProduct: FwCloudProduct;
  let manager: EntityManager;
  let service: OpenVPNStatusSamplingService;

  beforeEach(async () => {
    manager = db.getSource().manager;
    await testSuite.resetDatabaseData();
    fwcProduct = await new FwCloudFactory().make();
    service = await testSuite.app.getService<OpenVPNStatusSamplingService>(
      OpenVPNStatusSamplingService.name,
    );
  });

  afterEach(() => {
    sinon.restore();
  });

  async function setStatusOption(statusFile: string): Promise<void> {
    await manager.getRepository(OpenVPNOption).save(
      manager.getRepository(OpenVPNOption).create({
        openVPNId: fwcProduct.openvpnServer.id,
        name: 'status',
        arg: statusFile,
        order: 1,
        scope: 1,
      }),
    );
  }

  describe('save', () => {
    it('should save OpenVPN server sampling configuration', async () => {
      await setStatusOption('/run/openvpn/server.status');

      const openVPN: OpenVPN = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
      });

      expect(openVPN.id).to.eq(fwcProduct.openvpnServer.id);
      expect(Boolean(openVPN.statusSamplingEnabled)).to.eq(true);
    });

    it('should disable OpenVPN server sampling configuration', async () => {
      await setStatusOption('/run/openvpn/server.status');

      await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
      });

      const updated: OpenVPN = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: false,
        statusFile: null,
      });

      expect(updated.id).to.eq(fwcProduct.openvpnServer.id);
      expect(Boolean(updated.statusSamplingEnabled)).to.eq(false);
    });

    it('should reject enabled sampling without OpenVPN status option', async () => {
      await expect(
        service.save({
          openVPNId: fwcProduct.openvpnServer.id,
          enabled: true,
          statusFile: null,
        }),
      ).to.be.rejectedWith('OpenVPN status sampling requires a status option when enabled');
    });

    it('should reject relative status file paths', async () => {
      await expect(
        service.save({
          openVPNId: fwcProduct.openvpnServer.id,
          enabled: true,
          statusFile: 'openvpn/server.status',
        }),
      ).to.be.rejectedWith('OpenVPN status file path must be absolute');
    });
  });

  describe('findActiveCollectors', () => {
    it('should return enabled agent collectors with status files', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.Agent;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);
      await setStatusOption('/run/openvpn/server.status');

      await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
      });

      const collectors: OpenVPN[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(1);
      expect(collectors[0].id).to.eq(fwcProduct.openvpnServer.id);
      expect(collectors[0].firewallId).to.eq(fwcProduct.firewall.id);
      expect(collectors[0].openVPNOptions).to.have.length(1);
    });

    it('should skip disabled collectors even when a status file exists', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.Agent;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);
      await setStatusOption('/run/openvpn/server.status');

      await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: false,
        statusFile: '/run/openvpn/server.status',
      });

      const collectors: OpenVPN[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(0);
    });
  });

  describe('syncAgent', () => {
    it('should send all enabled OpenVPN server files for the collector', async () => {
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling,
      } as any);

      await setStatusOption('/run/openvpn/server.status');
      const openVPN: OpenVPN = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
      });

      const synced: OpenVPN = await service.syncAgent(openVPN);

      expect(syncOpenVPNStatusSampling.calledOnce).to.eq(true);
      expect(syncOpenVPNStatusSampling.firstCall.args[0]).to.deep.eq({
        statusFiles: [
          {
            path: '/run/openvpn/server.status',
            samplingInterval: 30,
            requestMaxLines: 1000,
            cacheMaxSize: 10485760,
          },
        ],
      });
      expect(synced.id).to.eq(fwcProduct.openvpnServer.id);
    });

    it('should send persisted OpenVPN server sampling parameters', async () => {
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling,
      } as any);

      await setStatusOption('/run/openvpn/server.status');
      const openVPN: OpenVPN = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
      });

      openVPN.statusSamplingInterval = 45;
      openVPN.statusSamplingRequestMaxLines = 500;
      openVPN.statusSamplingCacheMaxSize = 2097152;
      await manager.getRepository(OpenVPN).save(openVPN);

      await service.syncAgent(openVPN);

      expect(syncOpenVPNStatusSampling.calledOnce).to.eq(true);
      expect(syncOpenVPNStatusSampling.firstCall.args[0]).to.deep.eq({
        statusFiles: [
          {
            path: '/run/openvpn/server.status',
            samplingInterval: 45,
            requestMaxLines: 500,
            cacheMaxSize: 2097152,
          },
        ],
      });
    });

    it('should report failed synchronization', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling: sinon.stub().rejects(new Error('agent rejected config')),
      } as any);

      await setStatusOption('/run/openvpn/server.status');
      const openVPN: OpenVPN = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
      });

      await expect(service.syncAgent(openVPN)).to.be.rejectedWith('agent rejected config');
    });
  });
});
