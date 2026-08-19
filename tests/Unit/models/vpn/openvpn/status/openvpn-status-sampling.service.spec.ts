import { EntityManager } from 'typeorm';
import sinon from 'sinon';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../../../../src/models/firewall/Firewall';
import { OpenVPNStatusSamplingService } from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-sampling.service';
import { OpenVPNOption } from '../../../../../../src/models/vpn/openvpn/openvpn-option.model';
import { OpenVPN } from '../../../../../../src/models/vpn/openvpn/OpenVPN';
import { Crt } from '../../../../../../src/models/vpn/pki/Crt';
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

  async function setStatusOption(
    statusFile: string,
    openVPNId: number = fwcProduct.openvpnServer.id,
  ): Promise<void> {
    await manager.getRepository(OpenVPNOption).save(
      manager.getRepository(OpenVPNOption).create({
        openVPNId,
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
        samplingInterval: 45,
        requestMaxLines: 500,
        cacheMaxSize: 2097152,
      });

      expect(openVPN.id).to.eq(fwcProduct.openvpnServer.id);
      expect(Boolean(openVPN.statusSamplingEnabled)).to.eq(true);
      expect(openVPN.statusSamplingInterval).to.eq(45);
      expect(openVPN.statusSamplingRequestMaxLines).to.eq(500);
      expect(openVPN.statusSamplingCacheMaxSize).to.eq(2097152);
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

    it('should reject relative status option paths with dump intervals', async () => {
      await setStatusOption('openvpn/server.status 5');

      await expect(
        service.save({
          openVPNId: fwcProduct.openvpnServer.id,
          enabled: true,
          statusFile: '/run/openvpn/server.status',
        }),
      ).to.be.rejectedWith('OpenVPN status file path must be absolute: openvpn/server.status');
    });

    it('should reject invalid sampling parameters', async () => {
      await setStatusOption('/run/openvpn/server.status');

      await expect(
        service.save({
          openVPNId: fwcProduct.openvpnServer.id,
          enabled: true,
          statusFile: '/run/openvpn/server.status',
          samplingInterval: 0,
        }),
      ).to.be.rejectedWith('OpenVPN status sampling interval must be a positive integer');
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
    it('should send the status file path without its dump interval to the collector', async () => {
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling,
      } as any);

      await setStatusOption('/run/openvpn/server.status 5');
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

    it('should send all enabled OpenVPN server configurations for the firewall', async () => {
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling,
      } as any);

      const secondServerCrt: Crt = await manager.getRepository(Crt).save(
        manager.getRepository(Crt).create({
          caId: fwcProduct.ca.id,
          cn: 'OpenVPN-Server-2',
          days: 1000,
          type: 2,
        }),
      );
      const secondServer: OpenVPN = await manager.getRepository(OpenVPN).save(
        manager.getRepository(OpenVPN).create({
          parentId: null,
          firewallId: fwcProduct.firewall.id,
          crtId: secondServerCrt.id,
          statusSamplingEnabled: 1,
          statusSamplingInterval: 10,
          statusSamplingRequestMaxLines: 200,
          statusSamplingCacheMaxSize: 1024,
        }),
      );

      await setStatusOption('/run/openvpn/server.status');
      await setStatusOption('/run/openvpn/server-2.status', secondServer.id);
      const openVPN: OpenVPN = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        statusFile: '/run/openvpn/server.status',
        samplingInterval: 45,
        requestMaxLines: 500,
        cacheMaxSize: 2097152,
      });

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
          {
            path: '/run/openvpn/server-2.status',
            samplingInterval: 10,
            requestMaxLines: 200,
            cacheMaxSize: 1024,
          },
        ],
      });
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
