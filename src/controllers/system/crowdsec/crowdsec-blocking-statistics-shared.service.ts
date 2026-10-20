/*!
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
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { Request } from 'express';
import { CrowdSecFirewallBouncerStatisticsSamplingConfig } from '../../../communications/communication';
import db from '../../../database/database-manager';
import { AbstractApplication } from '../../../fonaments/abstract-application';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import {
  CrowdSecBlockingStatisticsHistoryPage,
  CrowdSecBlockingStatisticsHistoryRange,
  CrowdSecBlockingStatisticsHistorySample,
  CrowdSecBlockingStatisticsService,
} from '../../../models/system/crowdsec/crowdsec-blocking-statistics.service';
import { CrowdSecBlockingStatisticsSamplingService } from '../../../models/system/crowdsec/crowdsec-blocking-statistics-sampling.service';

export class CrowdSecBlockingStatisticsSharedService {
  static async statisticsService(
    application: AbstractApplication,
  ): Promise<CrowdSecBlockingStatisticsService> {
    return application.getService<CrowdSecBlockingStatisticsService>(
      CrowdSecBlockingStatisticsService.name,
    );
  }

  static samplingService(): CrowdSecBlockingStatisticsSamplingService {
    return new CrowdSecBlockingStatisticsSamplingService(db.getSource().manager);
  }

  static range(req: Request): CrowdSecBlockingStatisticsHistoryRange {
    const startsAt =
      req.query.starts_at === undefined ? undefined : new Date(Number(req.query.starts_at));
    const endsAt =
      req.query.ends_at === undefined ? undefined : new Date(Number(req.query.ends_at));
    if (
      (startsAt && Number.isNaN(startsAt.getTime())) ||
      (endsAt && Number.isNaN(endsAt.getTime()))
    ) {
      throw new HttpException('Invalid CrowdSec blocking statistics time range', 400);
    }
    if (startsAt && endsAt && startsAt > endsAt) {
      throw new HttpException('Invalid CrowdSec blocking statistics time range', 400);
    }
    return { startsAt, endsAt };
  }

  static addresses(value: unknown): string[] {
    if (typeof value !== 'string') {
      throw new HttpException('Invalid CrowdSec blocking statistics addresses', 400);
    }
    const addresses = value
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address.length > 0);
    if (addresses.length === 0 || addresses.some((address) => address.length > 255)) {
      throw new HttpException('Invalid CrowdSec blocking statistics addresses', 400);
    }
    return [...new Set(addresses)];
  }

  static pagination(req: Request): { page: number; limit: number } {
    return {
      page: req.query.page === undefined ? 1 : Number(req.query.page),
      limit: req.query.limit === undefined ? 1000 : Number(req.query.limit),
    };
  }

  static paginationResponse(
    history: CrowdSecBlockingStatisticsHistoryPage,
  ): Record<string, number> {
    return {
      page: history.page,
      limit: history.limit,
      total: history.total,
      pages: Math.ceil(history.total / history.limit),
    };
  }

  static samplingResponse(
    configuration: CrowdSecFirewallBouncerStatisticsSamplingConfig,
  ): Record<string, unknown> {
    return {
      enabled: configuration.enabled,
      sampling_interval: configuration.samplingInterval,
      request_max_samples: configuration.requestMaxSamples,
      cache_max_size: configuration.cacheMaxSize,
    };
  }

  static sampleResponse(sample: CrowdSecBlockingStatisticsHistorySample): Record<string, unknown> {
    return {
      collected_at: sample.collectedAt.toISOString(),
      policy_generation: sample.policyGeneration,
      ipv4_input: sample.ipv4Input,
      ipv4_forward: sample.ipv4Forward,
      ipv6_input: sample.ipv6Input,
      ipv6_forward: sample.ipv6Forward,
    };
  }

  static addressSampleResponse(sample: {
    address: string;
    collectedAt: Date;
    policyGeneration: string;
    packets: number;
    bytes: number;
  }): Record<string, unknown> {
    return {
      address: sample.address,
      collected_at: sample.collectedAt.toISOString(),
      policy_generation: sample.policyGeneration,
      packets: sample.packets,
      bytes: sample.bytes,
    };
  }
}
