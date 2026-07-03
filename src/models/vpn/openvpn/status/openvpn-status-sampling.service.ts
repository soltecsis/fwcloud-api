import * as path from 'path';
import { AgentCommunication } from '../../../../communications/agent.communication';
import { OpenVPNStatusSamplingAgentState } from '../../../../communications/communication';
import db from '../../../../database/database-manager';
import { Service } from '../../../../fonaments/services/service';
import { Firewall, FirewallInstallCommunication } from '../../../firewall/Firewall';
import { OpenVPN } from '../OpenVPN';
import { OpenVPNOption } from '../openvpn-option.model';

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
  public async build(): Promise<Service> {
    return this;
  }

  async findOneByOpenVPN(openVPNId: number): Promise<OpenVPN | null> {
    return db
      .getSource()
      .manager.getRepository(OpenVPN)
      .findOne({
        where: { id: openVPNId },
        relations: ['openVPNOptions', 'firewall'],
      });
  }

  async findActiveCollectors(): Promise<OpenVPN[]> {
    return db
      .getSource()
      .getRepository(OpenVPN)
      .createQueryBuilder('openVPN')
      .innerJoinAndSelect('openVPN.firewall', 'firewall')
      .innerJoinAndSelect('openVPN.openVPNOptions', 'options')
      .innerJoin('openVPN.crt', 'crt')
      .where('openVPN.statusSamplingEnabled = :enabled', { enabled: true })
      .andWhere('openVPN.parentId IS NULL')
      .andWhere('crt.type = :type', { type: 2 })
      .andWhere('firewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      })
      .getMany();
  }

  async syncAgent(openVPN: OpenVPN): Promise<OpenVPN> {
    const openVPNRepository = db.getSource().manager.getRepository(OpenVPN);
    openVPN = await openVPNRepository.findOneOrFail({
      where: { id: openVPN.id },
      relations: ['openVPNOptions', 'firewall'],
    });

    if (!openVPN.firewall) {
      throw new Error('OpenVPN status sampling firewall is not configured');
    }

    const firewallId = openVPN.firewallId;
    const communication: AgentCommunication =
      (await openVPN.firewall.getCommunication()) as AgentCommunication;
    const activeOpenVPNServers: OpenVPN[] = await openVPNRepository.find({
      where: {
        firewallId,
        statusSamplingEnabled: 1,
        parentId: null,
      },
      relations: ['openVPNOptions'],
    });

    await communication.syncOpenVPNStatusSampling({
      enabled: activeOpenVPNServers.length > 0,
      statusFiles: this.getUniqueStatusFiles(activeOpenVPNServers),
    });

    return openVPNRepository.findOne({
      where: { id: openVPN.id },
      relations: ['openVPNOptions', 'firewall'],
    });
  }

  async getAgentStatus(openVPN: OpenVPN | null): Promise<OpenVPNStatusSamplingAgentStatus | null> {
    if (!openVPN?.firewall) {
      return null;
    }

    try {
      const communication: AgentCommunication =
        (await openVPN.firewall.getCommunication()) as AgentCommunication;
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

  async save(data: OpenVPNStatusSamplingSaveData): Promise<OpenVPN> {
    const normalizedData: OpenVPNStatusSamplingSaveData = {
      ...data,
      statusFile: data.statusFile ? this.normalizeStatusFile(data.statusFile) : null,
    };

    this.validate(normalizedData);

    return db.getSource().transaction(async (manager) => {
      const openVPNRepository = manager.getRepository(OpenVPN);
      const openVPN: OpenVPN = await openVPNRepository.findOneOrFail({
        where: { id: normalizedData.openVPNId },
        relations: ['openVPNOptions', 'firewall'],
      });

      if (normalizedData.enabled) {
        const statusFile = this.getStatusFile(openVPN);
        if (!statusFile) {
          throw new Error('OpenVPN status sampling requires a status option when enabled');
        }

        this.normalizeStatusFile(statusFile);
      }

      openVPN.statusSamplingEnabled = normalizedData.enabled ? 1 : 0;
      await openVPNRepository.save(openVPN);

      return openVPNRepository.findOne({
        where: { id: openVPN.id },
        relations: ['openVPNOptions', 'firewall'],
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

    let lastOpenVPN: OpenVPN | null = null;

    for (const option of serverOptions) {
      const statusFile = statusFiles.find((file) => file === option.arg);

      if (!statusFile) {
        continue;
      }

      lastOpenVPN = await this.save({
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

    if (lastOpenVPN) {
      await this.syncAgent(lastOpenVPN);
    }

    return {
      imported,
      unmatched_status_files: statusFiles.filter((file) => !matchedStatusFiles.includes(file)),
    };
  }

  protected validate(data: OpenVPNStatusSamplingSaveData): void {
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

  protected getUniqueStatusFiles(openVPNServers: OpenVPN[]): string[] {
    const statusFiles: string[] = [];

    for (const openVPN of openVPNServers) {
      const statusFile = this.getStatusFile(openVPN);

      if (statusFile && !statusFiles.includes(statusFile)) {
        statusFiles.push(statusFile);
      }
    }

    return statusFiles;
  }

  protected getStatusFile(openVPN: OpenVPN): string | null {
    return (
      openVPN.openVPNOptions?.find((option: OpenVPNOption) => option.name === 'status')?.arg ?? null
    );
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
