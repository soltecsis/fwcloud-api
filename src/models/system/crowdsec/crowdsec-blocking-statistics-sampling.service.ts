/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { CrowdSecFirewallBouncerStatisticsSamplingConfig } from '../../../communications/communication';
import { EntityManager } from 'typeorm';
import { Firewall } from '../../../models/firewall/Firewall';
import { CrowdSecBlockingStatisticsSampling } from '../../../models/system/crowdsec/crowdsec-blocking-statistics-sampling.model';
import { CrowdSecLapiSharedService } from '../../../controllers/system/crowdsec/crowdsec-lapi-shared.service';

export type CrowdSecBlockingStatisticsSamplingNodeResult = {
  firewall_id: number;
  name: string;
  status: 'completed' | 'failed';
  error?: string;
};

export type CrowdSecBlockingStatisticsSamplingUpdateResult = {
  completed: boolean;
  configuration: CrowdSecFirewallBouncerStatisticsSamplingConfig;
  nodes: CrowdSecBlockingStatisticsSamplingNodeResult[];
};

export class CrowdSecBlockingStatisticsSamplingService {
  static readonly DEFAULT_SAMPLING_INTERVAL = 30;
  static readonly DEFAULT_REQUEST_MAX_SAMPLES = 1000;
  static readonly DEFAULT_CACHE_MAX_SIZE = 10485760;

  constructor(private readonly manager: EntityManager) {}

  async configuration(
    firewallId: number,
  ): Promise<CrowdSecFirewallBouncerStatisticsSamplingConfig> {
    const sampling = await this.manager
      .getRepository(CrowdSecBlockingStatisticsSampling)
      .findOne({ where: { firewallId } });

    return this.toConfiguration(sampling);
  }

  async update(
    firewalls: Firewall[],
    configuration: CrowdSecFirewallBouncerStatisticsSamplingConfig,
  ): Promise<CrowdSecBlockingStatisticsSamplingUpdateResult> {
    const normalizedConfiguration = this.normalizeConfiguration(configuration);
    const nodes = [...firewalls].sort((first, second) => first.id - second.id);

    await this.persist(nodes, normalizedConfiguration);

    const results: CrowdSecBlockingStatisticsSamplingNodeResult[] = [];
    for (const firewall of nodes) {
      try {
        const communication = await CrowdSecLapiSharedService.agentCommunication(firewall, false);
        await communication.updateCrowdSecFirewallBouncerStatisticsSampling(
          normalizedConfiguration,
        );
        results.push({
          firewall_id: firewall.id,
          name: firewall.name,
          status: 'completed',
        });
      } catch (error) {
        results.push({
          firewall_id: firewall.id,
          name: firewall.name,
          status: 'failed',
          error:
            error instanceof Error
              ? error.message
              : 'Unable to update CrowdSec Firewall Bouncer statistics sampling',
        });
      }
    }

    return {
      completed: results.every((result) => result.status === 'completed'),
      configuration: normalizedConfiguration,
      nodes: results,
    };
  }

  private async persist(
    firewalls: Firewall[],
    configuration: CrowdSecFirewallBouncerStatisticsSamplingConfig,
  ): Promise<void> {
    await this.manager.transaction(async (manager) => {
      const repository = manager.getRepository(CrowdSecBlockingStatisticsSampling);

      for (const firewall of firewalls) {
        const sampling =
          (await repository.findOne({ where: { firewallId: firewall.id } })) ??
          repository.create({ firewallId: firewall.id });
        sampling.enabled = configuration.enabled;
        sampling.samplingInterval = configuration.samplingInterval;
        sampling.requestMaxSamples = configuration.requestMaxSamples;
        sampling.cacheMaxSize = configuration.cacheMaxSize;
        await repository.save(sampling);
      }
    });
  }

  private normalizeConfiguration(
    configuration: CrowdSecFirewallBouncerStatisticsSamplingConfig,
  ): CrowdSecFirewallBouncerStatisticsSamplingConfig {
    for (const [field, value] of Object.entries({
      samplingInterval: configuration.samplingInterval,
      requestMaxSamples: configuration.requestMaxSamples,
      cacheMaxSize: configuration.cacheMaxSize,
    })) {
      if (!Number.isInteger(value) || value < 1) {
        throw new Error(`CrowdSec Firewall Bouncer statistics ${field} must be a positive integer`);
      }
    }

    return { ...configuration };
  }

  private toConfiguration(
    sampling: CrowdSecBlockingStatisticsSampling | null,
  ): CrowdSecFirewallBouncerStatisticsSamplingConfig {
    return {
      enabled: sampling?.enabled ?? false,
      samplingInterval:
        sampling?.samplingInterval ??
        CrowdSecBlockingStatisticsSamplingService.DEFAULT_SAMPLING_INTERVAL,
      requestMaxSamples:
        sampling?.requestMaxSamples ??
        CrowdSecBlockingStatisticsSamplingService.DEFAULT_REQUEST_MAX_SAMPLES,
      cacheMaxSize:
        sampling?.cacheMaxSize ?? CrowdSecBlockingStatisticsSamplingService.DEFAULT_CACHE_MAX_SIZE,
    };
  }
}
