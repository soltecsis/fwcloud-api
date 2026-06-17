import * as crypto from 'crypto';
import * as path from 'path';
import { EntityManager, Repository } from 'typeorm';
import db from '../../../../database/database-manager';
import { Service } from '../../../../fonaments/services/service';
import { FirewallInstallCommunication } from '../../../firewall/Firewall';
import { OpenVPNStatusSampling, OpenVPNStatusSamplingFile } from './openvpn-status-sampling';

export type OpenVPNStatusSamplingSaveData = {
  firewallId?: number;
  clusterId?: number;
  enabled: boolean;
  collectorFirewallId?: number;
  statusFiles?: string[];
};

export class OpenVPNStatusSamplingService extends Service {
  protected _repository: Repository<OpenVPNStatusSampling>;

  public async build(): Promise<Service> {
    this._repository = db.getSource().manager.getRepository(OpenVPNStatusSampling);
    return this;
  }

  async findOneByFirewall(firewallId: number): Promise<OpenVPNStatusSampling | null> {
    return this._repository.findOne({
      where: { firewallId },
      relations: ['files', 'firewall', 'cluster', 'collectorFirewall'],
    });
  }

  async findOneByCluster(clusterId: number): Promise<OpenVPNStatusSampling | null> {
    return this._repository.findOne({
      where: { clusterId },
      relations: ['files', 'firewall', 'cluster', 'collectorFirewall'],
    });
  }

  async findActiveCollectors(): Promise<OpenVPNStatusSampling[]> {
    return this._repository
      .createQueryBuilder('sampling')
      .leftJoinAndSelect('sampling.firewall', 'firewall')
      .leftJoinAndSelect('sampling.cluster', 'cluster')
      .innerJoinAndSelect('sampling.collectorFirewall', 'collectorFirewall')
      .innerJoinAndSelect('sampling.files', 'files')
      .where('sampling.enabled = :enabled', { enabled: true })
      .andWhere('sampling.collectorFirewallId IS NOT NULL')
      .andWhere('collectorFirewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      })
      .getMany();
  }

  async save(data: OpenVPNStatusSamplingSaveData): Promise<OpenVPNStatusSampling> {
    const normalizedData: OpenVPNStatusSamplingSaveData = {
      ...data,
      statusFiles: this.normalizeStatusFiles(data.statusFiles ?? []),
      collectorFirewallId: this.resolveCollectorFirewallId(data),
    };

    this.validate(normalizedData);

    return db.getSource().transaction(async (manager: EntityManager) => {
      const samplingRepository = manager.getRepository(OpenVPNStatusSampling);
      const fileRepository = manager.getRepository(OpenVPNStatusSamplingFile);
      let sampling: OpenVPNStatusSampling | null = normalizedData.firewallId
        ? await samplingRepository.findOne({ where: { firewallId: normalizedData.firewallId } })
        : await samplingRepository.findOne({ where: { clusterId: normalizedData.clusterId } });

      if (!sampling) {
        sampling = samplingRepository.create({
          firewallId: normalizedData.firewallId ?? null,
          clusterId: normalizedData.clusterId ?? null,
        });
      }

      sampling.enabled = normalizedData.enabled;
      sampling.collectorFirewallId = normalizedData.collectorFirewallId ?? null;
      sampling = await samplingRepository.save(sampling);

      await fileRepository.delete({ samplingId: sampling.id });

      if (normalizedData.statusFiles.length > 0) {
        await fileRepository.save(
          normalizedData.statusFiles.map((statusFile) =>
            fileRepository.create({
              samplingId: sampling.id,
              path: statusFile,
              pathHash: this.hashStatusFilePath(statusFile),
            }),
          ),
        );
      }

      return samplingRepository.findOne({
        where: { id: sampling.id },
        relations: ['files', 'firewall', 'cluster', 'collectorFirewall'],
      });
    });
  }

  protected validate(data: OpenVPNStatusSamplingSaveData): void {
    if (Boolean(data.firewallId) === Boolean(data.clusterId)) {
      throw new Error('OpenVPN status sampling must target one firewall or one cluster');
    }

    if (data.enabled && data.statusFiles.length === 0) {
      throw new Error('OpenVPN status sampling requires at least one status file when enabled');
    }

    if (data.enabled && !data.collectorFirewallId) {
      throw new Error('OpenVPN status sampling requires a collector firewall when enabled');
    }
  }

  protected resolveCollectorFirewallId(data: OpenVPNStatusSamplingSaveData): number | undefined {
    return data.collectorFirewallId ?? data.firewallId;
  }

  protected normalizeStatusFiles(statusFiles: string[]): string[] {
    const normalizedPaths: string[] = [];

    for (const statusFile of statusFiles) {
      const normalizedPath = statusFile.trim();

      if (!normalizedPath) {
        throw new Error('OpenVPN status file path cannot be empty');
      }

      if (!path.posix.isAbsolute(normalizedPath)) {
        throw new Error(`OpenVPN status file path must be absolute: ${normalizedPath}`);
      }

      if (!normalizedPaths.includes(normalizedPath)) {
        normalizedPaths.push(normalizedPath);
      }
    }

    return normalizedPaths;
  }

  protected hashStatusFilePath(statusFile: string): string {
    return crypto.createHash('sha256').update(statusFile).digest('hex');
  }
}
