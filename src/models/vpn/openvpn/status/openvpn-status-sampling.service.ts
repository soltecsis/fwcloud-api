import * as crypto from 'crypto';
import * as path from 'path';
import { EntityManager, Repository } from 'typeorm';
import { AgentCommunication } from '../../../../communications/agent.communication';
import { OpenVPNStatusSamplingAgentState } from '../../../../communications/communication';
import db from '../../../../database/database-manager';
import { Service } from '../../../../fonaments/services/service';
import { Firewall, FirewallInstallCommunication } from '../../../firewall/Firewall';
import { OpenVPNOption } from '../openvpn-option.model';
import { OpenVPNStatusSampling, OpenVPNStatusSamplingFile } from './openvpn-status-sampling';

export type OpenVPNStatusSamplingSaveData = {
  openVPNId: number;
  enabled: boolean;
  collectorFirewallId: number;
  statusFile?: string | null;
};

export type OpenVPNStatusSamplingAgentStatus = {
  enabled: boolean;
  statusFiles: string[];
  error: string | null;
};

export type OpenVPNStatusSamplingImportSummary = {
  imported: Array<{ openvpn: number; status_file: string }>;
  unmatched_status_files: string[];
};

export class OpenVPNStatusSamplingService extends Service {
  protected _repository: Repository<OpenVPNStatusSampling>;

  public async build(): Promise<Service> {
    this._repository = db.getSource().manager.getRepository(OpenVPNStatusSampling);
    return this;
  }

  async findOneByOpenVPN(openVPNId: number): Promise<OpenVPNStatusSampling | null> {
    return this._repository.findOne({
      where: { openVPNId },
      relations: ['files', 'openVPN', 'collectorFirewall'],
    });
  }

  async findActiveCollectors(): Promise<OpenVPNStatusSampling[]> {
    return this._repository
      .createQueryBuilder('sampling')
      .innerJoinAndSelect('sampling.openVPN', 'openVPN')
      .innerJoinAndSelect('sampling.collectorFirewall', 'collectorFirewall')
      .innerJoinAndSelect('sampling.files', 'files')
      .where('sampling.enabled = :enabled', { enabled: true })
      .andWhere('sampling.collectorFirewallId IS NOT NULL')
      .andWhere('collectorFirewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      })
      .getMany();
  }

  async syncAgent(sampling: OpenVPNStatusSampling): Promise<OpenVPNStatusSampling> {
    const samplingRepository = db.getSource().manager.getRepository(OpenVPNStatusSampling);
    sampling = await samplingRepository.findOneOrFail({
      where: { id: sampling.id },
      relations: ['files', 'collectorFirewall'],
    });

    try {
      if (!sampling.collectorFirewall) {
        throw new Error('OpenVPN status sampling collector firewall is not configured');
      }

      const collectorFirewallId = sampling.collectorFirewallId;
      const communication: AgentCommunication =
        (await sampling.collectorFirewall.getCommunication()) as AgentCommunication;
      const activeCollectorSamplings: OpenVPNStatusSampling[] = await samplingRepository.find({
        where: {
          enabled: true,
          collectorFirewallId,
        },
        relations: ['files'],
      });

      await communication.syncOpenVPNStatusSampling({
        enabled: activeCollectorSamplings.length > 0,
        statusFiles: this.getUniqueStatusFiles(activeCollectorSamplings),
      });

      sampling.lastSyncResult = 'accepted';
      sampling.lastSyncError = null;
    } catch (error) {
      sampling.lastSyncResult = 'failed';
      sampling.lastSyncError = this.getErrorMessage(error);
    }

    sampling.lastSyncedAt = new Date();
    await samplingRepository.save(sampling);

    return samplingRepository.findOne({
      where: { id: sampling.id },
      relations: ['files', 'openVPN', 'collectorFirewall'],
    });
  }

  async getAgentStatus(
    sampling: OpenVPNStatusSampling | null,
  ): Promise<OpenVPNStatusSamplingAgentStatus | null> {
    if (!sampling?.collectorFirewall) {
      return null;
    }

    try {
      const communication: AgentCommunication =
        (await sampling.collectorFirewall.getCommunication()) as AgentCommunication;
      const state: OpenVPNStatusSamplingAgentState =
        await communication.getOpenVPNStatusSamplingState();

      return {
        enabled: Boolean(state.enabled),
        statusFiles: state.statusFiles,
        error: null,
      };
    } catch (error) {
      return {
        enabled: false,
        statusFiles: [],
        error: this.getErrorMessage(error),
      };
    }
  }

  async save(data: OpenVPNStatusSamplingSaveData): Promise<OpenVPNStatusSampling> {
    const normalizedData: OpenVPNStatusSamplingSaveData = {
      ...data,
      statusFile: data.statusFile ? this.normalizeStatusFile(data.statusFile) : null,
    };

    this.validate(normalizedData);

    return db.getSource().transaction(async (manager: EntityManager) => {
      const samplingRepository = manager.getRepository(OpenVPNStatusSampling);
      const fileRepository = manager.getRepository(OpenVPNStatusSamplingFile);
      let sampling: OpenVPNStatusSampling | null = await samplingRepository.findOne({
        where: { openVPNId: normalizedData.openVPNId },
      });

      if (!sampling) {
        sampling = samplingRepository.create({
          openVPNId: normalizedData.openVPNId,
        });
      }

      sampling.enabled = normalizedData.enabled;
      sampling.collectorFirewallId = normalizedData.collectorFirewallId ?? null;
      sampling = await samplingRepository.save(sampling);

      await fileRepository.delete({ samplingId: sampling.id });

      if (normalizedData.statusFile) {
        await fileRepository.save(
          fileRepository.create({
            samplingId: sampling.id,
            path: normalizedData.statusFile,
            pathHash: this.hashStatusFilePath(normalizedData.statusFile),
          }),
        );
      }

      return samplingRepository.findOne({
        where: { id: sampling.id },
        relations: ['files', 'openVPN', 'collectorFirewall'],
      });
    });
  }

  async importFromAgentEnv(firewallId: number): Promise<OpenVPNStatusSamplingImportSummary> {
    const firewallRepository = db.getSource().manager.getRepository(Firewall);
    const firewall = await firewallRepository.findOneOrFail({ where: { id: firewallId } });
    const communication: AgentCommunication =
      (await firewall.getCommunication()) as AgentCommunication;
    const state: OpenVPNStatusSamplingAgentState =
      await communication.getOpenVPNStatusSamplingEnvState();
    const statusFiles = state.statusFiles ?? [];
    const imported: Array<{ openvpn: number; status_file: string }> = [];
    const matchedStatusFiles: string[] = [];

    if (!state.enabled || statusFiles.length === 0) {
      return { imported, unmatched_status_files: [] };
    }

    const serverOptions = await db
      .getSource()
      .getRepository(OpenVPNOption)
      .createQueryBuilder('option')
      .innerJoinAndSelect('option.openVPN', 'openvpn')
      .innerJoin('openvpn.crt', 'crt')
      .where('openvpn.firewallId = :firewallId', { firewallId })
      .andWhere('openvpn.parentId IS NULL')
      .andWhere('crt.type = :type', { type: 2 })
      .andWhere('option.name = :name', { name: 'status' })
      .getMany();

    let lastSampling: OpenVPNStatusSampling | null = null;

    for (const option of serverOptions) {
      const statusFile = statusFiles.find((file) => file === option.arg);

      if (!statusFile) {
        continue;
      }

      lastSampling = await this.save({
        openVPNId: option.openVPNId,
        enabled: true,
        collectorFirewallId: firewallId,
        statusFile,
      });

      imported.push({ openvpn: option.openVPNId, status_file: statusFile });

      if (!matchedStatusFiles.includes(statusFile)) {
        matchedStatusFiles.push(statusFile);
      }
    }

    if (lastSampling) {
      await this.syncAgent(lastSampling);
    }

    return {
      imported,
      unmatched_status_files: statusFiles.filter((file) => !matchedStatusFiles.includes(file)),
    };
  }

  protected validate(data: OpenVPNStatusSamplingSaveData): void {
    if (data.enabled && !data.statusFile) {
      throw new Error('OpenVPN status sampling requires at least one status file when enabled');
    }

    if (data.enabled && !data.collectorFirewallId) {
      throw new Error('OpenVPN status sampling requires a collector firewall when enabled');
    }
  }

  protected normalizeStatusFile(statusFile: string): string {
    const normalizedPath = statusFile.trim();

    if (!normalizedPath) {
      throw new Error('OpenVPN status file path cannot be empty');
    }

    if (!path.posix.isAbsolute(normalizedPath)) {
      throw new Error(`OpenVPN status file path must be absolute: ${normalizedPath}`);
    }

    return normalizedPath;
  }

  protected getUniqueStatusFiles(samplings: OpenVPNStatusSampling[]): string[] {
    const statusFiles: string[] = [];

    for (const sampling of samplings) {
      for (const file of sampling.files ?? []) {
        if (!statusFiles.includes(file.path)) {
          statusFiles.push(file.path);
        }
      }
    }

    return statusFiles;
  }

  protected hashStatusFilePath(statusFile: string): string {
    return crypto.createHash('sha256').update(statusFile).digest('hex');
  }

  protected getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }

    if (typeof error === 'string') {
      return error;
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
}
