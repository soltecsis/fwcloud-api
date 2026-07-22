import * as path from 'path';
import { AgentCommunication } from '../../../../communications/agent.communication';
import { OpenVPNStatusSamplingAgentStatusFile } from '../../../../communications/communication';
import db from '../../../../database/database-manager';
import { Service } from '../../../../fonaments/services/service';
import { FirewallInstallCommunication } from '../../../firewall/Firewall';
import { OpenVPN } from '../OpenVPN';
import { OpenVPNOption } from '../openvpn-option.model';

export type OpenVPNStatusSamplingSaveData = {
  openVPNId: number;
  enabled: boolean;
  statusFile?: string | null;
  samplingInterval?: number;
  requestMaxLines?: number;
  cacheMaxSize?: number;
};

export const extractOpenVPNStatusFilePath = (
  statusOptionArgument: string | null | undefined,
): string | null => {
  const normalizedArgument = statusOptionArgument?.trim();

  if (!normalizedArgument) {
    return null;
  }

  return normalizedArgument.split(/\s+/)[0] ?? null;
};

export class OpenVPNStatusSamplingService extends Service {
  static readonly DEFAULT_SAMPLING_INTERVAL = 30;
  static readonly DEFAULT_REQUEST_MAX_LINES = 1000;
  static readonly DEFAULT_CACHE_MAX_SIZE = 10485760;

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
      statusFiles: this.getUniqueStatusFileConfigs(activeOpenVPNServers),
    });

    return openVPNRepository.findOne({
      where: { id: openVPN.id },
      relations: ['openVPNOptions', 'firewall'],
    });
  }

  async save(data: OpenVPNStatusSamplingSaveData): Promise<OpenVPN> {
    const normalizedData: OpenVPNStatusSamplingSaveData = {
      ...data,
      statusFile: data.statusFile ? this.normalizeStatusFile(data.statusFile) : null,
    };

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
      openVPN.statusSamplingInterval = this.normalizeSamplingParameter(
        normalizedData.samplingInterval,
        openVPN.statusSamplingInterval ?? OpenVPNStatusSamplingService.DEFAULT_SAMPLING_INTERVAL,
        'interval',
      );
      openVPN.statusSamplingRequestMaxLines = this.normalizeSamplingParameter(
        normalizedData.requestMaxLines,
        openVPN.statusSamplingRequestMaxLines ??
          OpenVPNStatusSamplingService.DEFAULT_REQUEST_MAX_LINES,
        'request max lines',
      );
      openVPN.statusSamplingCacheMaxSize = this.normalizeSamplingParameter(
        normalizedData.cacheMaxSize,
        openVPN.statusSamplingCacheMaxSize ?? OpenVPNStatusSamplingService.DEFAULT_CACHE_MAX_SIZE,
        'cache max size',
      );
      await openVPNRepository.save(openVPN);

      return openVPNRepository.findOne({
        where: { id: openVPN.id },
        relations: ['openVPNOptions', 'firewall'],
      });
    });
  }

  protected normalizeStatusFile(statusFile: string): string {
    const normalizedPath = extractOpenVPNStatusFilePath(statusFile);

    if (!normalizedPath) {
      throw new Error('OpenVPN status file path cannot be empty');
    }

    if (!path.posix.isAbsolute(normalizedPath)) {
      throw new Error(`OpenVPN status file path must be absolute: ${normalizedPath}`);
    }

    return normalizedPath;
  }

  protected normalizeSamplingParameter(
    value: number | undefined,
    fallback: number,
    fieldName: string,
  ): number {
    if (value === undefined) {
      return fallback;
    }

    if (!Number.isInteger(value) || value < 1) {
      throw new Error(`OpenVPN status sampling ${fieldName} must be a positive integer`);
    }

    return value;
  }

  protected getUniqueStatusFileConfigs(
    openVPNServers: OpenVPN[],
  ): OpenVPNStatusSamplingAgentStatusFile[] {
    const statusFiles: OpenVPNStatusSamplingAgentStatusFile[] = [];

    for (const openVPN of openVPNServers) {
      const statusFile = this.getStatusFile(openVPN);

      if (statusFile && !statusFiles.some((item) => item.path === statusFile)) {
        statusFiles.push({
          path: statusFile,
          samplingInterval:
            openVPN.statusSamplingInterval ??
            OpenVPNStatusSamplingService.DEFAULT_SAMPLING_INTERVAL,
          requestMaxLines:
            openVPN.statusSamplingRequestMaxLines ??
            OpenVPNStatusSamplingService.DEFAULT_REQUEST_MAX_LINES,
          cacheMaxSize:
            openVPN.statusSamplingCacheMaxSize ??
            OpenVPNStatusSamplingService.DEFAULT_CACHE_MAX_SIZE,
        });
      }
    }

    return statusFiles;
  }

  protected getStatusFile(openVPN: OpenVPN): string | null {
    return extractOpenVPNStatusFilePath(
      openVPN.openVPNOptions?.find((option: OpenVPNOption) => option.name === 'status')?.arg,
    );
  }
}
