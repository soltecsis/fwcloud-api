import { EntityManager } from 'typeorm';
import sinon from 'sinon';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../../../../src/models/firewall/Firewall';
import {
  OpenVPNStatusSampling,
  OpenVPNStatusSamplingFile,
} from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-sampling';
import { OpenVPNStatusSamplingService } from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-sampling.service';
import { OpenVPNOption } from '../../../../../../src/models/vpn/openvpn/openvpn-option.model';
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

  describe('save', () => {
    it('should save OpenVPN server sampling configuration', async () => {
      const sampling: OpenVPNStatusSampling = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      expect(Boolean(sampling.enabled)).to.eq(true);
      expect(sampling.openVPNId).to.eq(fwcProduct.openvpnServer.id);
      expect(sampling.collectorFirewallId).to.eq(fwcProduct.firewall.id);
      expect(sampling.files).to.have.length(1);
      expect(sampling.files[0].path).to.eq('/run/openvpn/server.status');
      expect(sampling.files[0].pathHash).to.have.length(64);
    });

    it('should replace the OpenVPN server status file', async () => {
      const original: OpenVPNStatusSampling = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      const updated: OpenVPNStatusSampling = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/clients.status',
      });

      const persistedFiles: OpenVPNStatusSamplingFile[] = await manager
        .getRepository(OpenVPNStatusSamplingFile)
        .find({ where: { samplingId: original.id } });

      expect(updated.id).to.eq(original.id);
      expect(updated.files).to.have.length(1);
      expect(updated.files[0].path).to.eq('/run/openvpn/clients.status');
      expect(persistedFiles).to.have.length(1);
      expect(persistedFiles[0].path).to.eq('/run/openvpn/clients.status');
    });

    it('should reject enabled sampling without status file', async () => {
      await expect(
        service.save({
          openVPNId: fwcProduct.openvpnServer.id,
          enabled: true,
          collectorFirewallId: fwcProduct.firewall.id,
          statusFile: null,
        }),
      ).to.be.rejectedWith(
        'OpenVPN status sampling requires at least one status file when enabled',
      );
    });

    it('should reject relative status file paths', async () => {
      await expect(
        service.save({
          openVPNId: fwcProduct.openvpnServer.id,
          enabled: true,
          collectorFirewallId: fwcProduct.firewall.id,
          statusFile: 'openvpn/server.status',
        }),
      ).to.be.rejectedWith('OpenVPN status file path must be absolute');
    });
  });

  describe('findActiveCollectors', () => {
    it('should return enabled agent collectors with status files', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.Agent;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);

      await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      const collectors: OpenVPNStatusSampling[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(1);
      expect(collectors[0].openVPNId).to.eq(fwcProduct.openvpnServer.id);
      expect(collectors[0].collectorFirewallId).to.eq(fwcProduct.firewall.id);
      expect(collectors[0].files).to.have.length(1);
    });

    it('should skip disabled collectors even when a status file exists', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.Agent;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);

      await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: false,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      const collectors: OpenVPNStatusSampling[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(0);
    });
  });

  describe('syncAgent', () => {
    it('should send all enabled OpenVPN server files for the collector', async () => {
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling,
      } as any);

      const sampling: OpenVPNStatusSampling = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      const synced: OpenVPNStatusSampling = await service.syncAgent(sampling);

      expect(syncOpenVPNStatusSampling.calledOnce).to.eq(true);
      expect(syncOpenVPNStatusSampling.firstCall.args[0]).to.deep.eq({
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });
      expect(synced.lastSyncResult).to.eq('accepted');
      expect(synced.lastSyncError).to.be.null;
      expect(synced.lastSyncedAt).not.to.be.null;
    });

    it('should record failed synchronization', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling: sinon.stub().rejects(new Error('agent rejected config')),
      } as any);

      const sampling: OpenVPNStatusSampling = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      const synced: OpenVPNStatusSampling = await service.syncAgent(sampling);

      expect(synced.lastSyncResult).to.eq('failed');
      expect(synced.lastSyncError).to.eq('agent rejected config');
      expect(synced.lastSyncedAt).not.to.be.null;
    });
  });

  describe('getAgentStatus', () => {
    it('should return the collector agent sampling status', async () => {
      const getOpenVPNStatusSamplingState = sinon.stub().resolves({
        accepted: true,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        getOpenVPNStatusSamplingState,
      } as any);

      const sampling: OpenVPNStatusSampling = await service.save({
        openVPNId: fwcProduct.openvpnServer.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFile: '/run/openvpn/server.status',
      });

      const status = await service.getAgentStatus(sampling);

      expect(getOpenVPNStatusSamplingState.calledOnce).to.eq(true);
      expect(status).to.deep.eq({
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
        error: null,
      });
    });
  });

  describe('importFromAgentEnv', () => {
    it('should import agent status files matching OpenVPN server status options', async () => {
      const statusFile = '/run/openvpn/server.status';
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      const getOpenVPNStatusSamplingEnvState = sinon.stub().resolves({
        enabled: true,
        statusFiles: [statusFile, '/run/openvpn/unmatched.status'],
      });
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        getOpenVPNStatusSamplingEnvState,
        syncOpenVPNStatusSampling,
      } as any);

      await manager.getRepository(OpenVPNOption).save(
        manager.getRepository(OpenVPNOption).create({
          openVPNId: fwcProduct.openvpnServer.id,
          name: 'status',
          arg: statusFile,
          order: 1,
          scope: 1,
        }),
      );

      const result = await service.importFromAgentEnv(fwcProduct.firewall.id);
      const sampling = await service.findOneByOpenVPN(fwcProduct.openvpnServer.id);

      expect(result.imported).to.deep.eq([
        { openvpn: fwcProduct.openvpnServer.id, status_file: statusFile },
      ]);
      expect(result.unmatched_status_files).to.deep.eq(['/run/openvpn/unmatched.status']);
      expect(Boolean(sampling.enabled)).to.eq(true);
      expect(sampling.files[0].path).to.eq(statusFile);
      expect(syncOpenVPNStatusSampling.calledOnce).to.eq(true);
      expect(syncOpenVPNStatusSampling.firstCall.args[0]).to.deep.eq({
        enabled: true,
        statusFiles: [statusFile],
      });
    });
  });
});
