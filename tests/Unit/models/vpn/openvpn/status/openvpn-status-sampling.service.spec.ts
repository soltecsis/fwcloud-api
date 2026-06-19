import { EntityManager } from 'typeorm';
import sinon from 'sinon';
import { Cluster } from '../../../../../../src/models/firewall/Cluster';
import {
  Firewall,
  FirewallInstallCommunication,
} from '../../../../../../src/models/firewall/Firewall';
import {
  OpenVPNStatusSampling,
  OpenVPNStatusSamplingFile,
} from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-sampling';
import { OpenVPNStatusSamplingService } from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-sampling.service';
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
    it('should save firewall sampling configuration', async () => {
      const sampling: OpenVPNStatusSampling = await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: [
          '/run/openvpn/server.status',
          '/run/openvpn/server.status',
          '/run/openvpn/clients.status',
        ],
      });

      expect(Boolean(sampling.enabled)).to.eq(true);
      expect(sampling.firewallId).to.eq(fwcProduct.firewall.id);
      expect(sampling.clusterId).to.be.null;
      expect(sampling.collectorFirewallId).to.eq(fwcProduct.firewall.id);
      expect(sampling.files).to.have.length(2);
      expect(sampling.files.map((file) => file.path)).to.have.members([
        '/run/openvpn/server.status',
        '/run/openvpn/clients.status',
      ]);
      expect(sampling.files[0].pathHash).to.have.length(64);
    });

    it('should replace the status file list', async () => {
      const original: OpenVPNStatusSampling = await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });

      const updated: OpenVPNStatusSampling = await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/clients.status'],
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

    it('should save cluster sampling configuration with a collector firewall', async () => {
      const cluster: Cluster = await manager.getRepository(Cluster).save(
        manager.getRepository(Cluster).create({
          name: 'cluster',
          fwCloudId: fwcProduct.fwcloud.id,
        }),
      );

      const sampling: OpenVPNStatusSampling = await service.save({
        clusterId: cluster.id,
        enabled: true,
        collectorFirewallId: fwcProduct.firewall.id,
        statusFiles: ['/run/openvpn/server.status'],
      });

      expect(sampling.firewallId).to.be.null;
      expect(sampling.clusterId).to.eq(cluster.id);
      expect(sampling.collectorFirewallId).to.eq(fwcProduct.firewall.id);
      expect(sampling.files).to.have.length(1);
    });

    it('should reject enabled sampling without status files', async () => {
      await expect(
        service.save({
          firewallId: fwcProduct.firewall.id,
          enabled: true,
          statusFiles: [],
        }),
      ).to.be.rejectedWith(
        'OpenVPN status sampling requires at least one status file when enabled',
      );
    });

    it('should reject relative status file paths', async () => {
      await expect(
        service.save({
          firewallId: fwcProduct.firewall.id,
          enabled: true,
          statusFiles: ['openvpn/server.status'],
        }),
      ).to.be.rejectedWith('OpenVPN status file path must be absolute');
    });

    it('should reject configurations targeting a firewall and a cluster at once', async () => {
      await expect(
        service.save({
          firewallId: fwcProduct.firewall.id,
          clusterId: 1,
          enabled: false,
          statusFiles: [],
        }),
      ).to.be.rejectedWith('OpenVPN status sampling must target one firewall or one cluster');
    });
  });

  describe('findActiveCollectors', () => {
    it('should return enabled agent collectors with status files', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.Agent;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);

      await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });

      const collectors: OpenVPNStatusSampling[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(1);
      expect(collectors[0].collectorFirewallId).to.eq(fwcProduct.firewall.id);
      expect(collectors[0].files).to.have.length(1);
    });

    it('should skip disabled collectors even when status files exist', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.Agent;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);

      await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: false,
        statusFiles: ['/run/openvpn/server.status'],
      });

      const collectors: OpenVPNStatusSampling[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(0);
    });

    it('should skip collectors that do not use agent communication', async () => {
      fwcProduct.firewall.install_communication = FirewallInstallCommunication.SSH;
      await manager.getRepository(Firewall).save(fwcProduct.firewall);

      await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });

      const collectors: OpenVPNStatusSampling[] = await service.findActiveCollectors();

      expect(collectors).to.have.length(0);
    });
  });

  describe('syncAgent', () => {
    it('should record accepted synchronization', async () => {
      const syncOpenVPNStatusSampling = sinon.stub().resolves(undefined);
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        syncOpenVPNStatusSampling,
      } as any);

      const sampling: OpenVPNStatusSampling = await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
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
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
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
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });

      const status = await service.getAgentStatus(sampling);

      expect(getOpenVPNStatusSamplingState.calledOnce).to.eq(true);
      expect(status).to.deep.eq({
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
        error: null,
      });
    });

    it('should return an error when the collector agent status cannot be read', async () => {
      sinon.stub(Firewall.prototype, 'getCommunication').resolves({
        getOpenVPNStatusSamplingState: sinon.stub().rejects(new Error('agent unavailable')),
      } as any);

      const sampling: OpenVPNStatusSampling = await service.save({
        firewallId: fwcProduct.firewall.id,
        enabled: true,
        statusFiles: ['/run/openvpn/server.status'],
      });

      const status = await service.getAgentStatus(sampling);

      expect(status).to.deep.eq({
        enabled: false,
        statusFiles: [],
        error: 'agent unavailable',
      });
    });
  });
});
