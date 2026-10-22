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

import { Application } from '../../../Application';
import { CrowdSecFirewallBouncerStatisticsSamples } from '../../../communications/communication';
import db from '../../../database/database-manager';
import { Firewall, FirewallInstallCommunication } from '../../firewall/Firewall';
import { AuditEventService, AuditEventStatus } from '../../audit/AuditEvent.service';
import { CrowdSecBlockingStatisticsSampling } from './crowdsec-blocking-statistics-sampling.model';
import { CrowdSecBlockingStatisticsService } from './crowdsec-blocking-statistics.service';
import { CrowdSecLapiSharedService } from '../../../controllers/system/crowdsec/crowdsec-lapi-shared.service';

const AUDIT_ENTITY = 'CrowdSecBlockingStatistics';

export type CrowdSecBlockingStatisticsWorkerDependencies = {
  getFirewalls: () => Promise<Firewall[]>;
};

const defaultDependencies: CrowdSecBlockingStatisticsWorkerDependencies = {
  getFirewalls: (): Promise<Firewall[]> =>
    db
      .getSource()
      .getRepository(CrowdSecBlockingStatisticsSampling)
      .createQueryBuilder('sampling')
      .innerJoinAndSelect('sampling.firewall', 'firewall')
      .where('sampling.enabled = :enabled', { enabled: true })
      .andWhere('firewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      })
      .orderBy('firewall.id', 'ASC')
      .getMany()
      .then((samplings) => samplings.map((sampling) => sampling.firewall)),
};

type WorkerIterationSummary = {
  processedFirewalls: number;
  insertedSamples: number;
  errorsCount: number;
};

const errorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
};

export async function iterate(
  application: Application,
  dependencies: CrowdSecBlockingStatisticsWorkerDependencies = defaultDependencies,
): Promise<void> {
  let auditEventService: AuditEventService | null = null;
  let eventId: string | null = null;
  let status: AuditEventStatus = 'success';
  let fatalError: string | null = null;
  const recoverableErrors: string[] = [];
  const summary: WorkerIterationSummary = {
    processedFirewalls: 0,
    insertedSamples: 0,
    errorsCount: 0,
  };

  try {
    auditEventService = await application.getService<AuditEventService>(AuditEventService.name);
    eventId = auditEventService.startEvent({
      source: 'worker',
      operation: 'sync',
      entity: AUDIT_ENTITY,
    });
    const service = await application.getService<CrowdSecBlockingStatisticsService>(
      CrowdSecBlockingStatisticsService.name,
    );

    for (const firewall of await dependencies.getFirewalls()) {
      summary.processedFirewalls++;
      try {
        const communication = await CrowdSecLapiSharedService.agentCommunication(firewall, false);
        const statistics: CrowdSecFirewallBouncerStatisticsSamples =
          await communication.takeCrowdSecFirewallBouncerStatistics();
        summary.insertedSamples += await service.create(firewall.id, statistics.samples);
      } catch (error) {
        summary.errorsCount++;
        const message = errorMessage(error);
        recoverableErrors.push(`Firewall ${firewall.id}: ${message}`);
        application
          .logger()
          .error(`WorkerError: CrowdSec Firewall ${firewall.id} failed: ${message}`);
      }
    }
  } catch (error) {
    status = 'failed';
    fatalError = errorMessage(error);
    application.logger().error(`WorkerError: ${fatalError}`);
  } finally {
    if (auditEventService && eventId) {
      await auditEventService.finishEvent(eventId, {
        affectedCount: summary.insertedSamples,
        status,
        error: status === 'failed' ? fatalError : null,
        details: {
          source: 'worker',
          operation: 'sync',
          entity: AUDIT_ENTITY,
          processedFirewalls: summary.processedFirewalls,
          insertedSamples: summary.insertedSamples,
          errorsCount: summary.errorsCount,
          error: fatalError ?? (recoverableErrors.length > 0 ? recoverableErrors[0] : null),
        },
      });
    }
  }
}

export async function waitUntilNextIteration(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(ms, 0)));
}

export async function work(): Promise<void> {
  const application = await Application.run();
  const interval = application.config.get('crowdsec.blocking_statistics.collection_interval');

  application
    .logger()
    .info(
      `CrowdSec blocking statistics worker started (collection interval: ${interval} minutes).`,
    );

  while (true) {
    const startedAt = Date.now();
    await iterate(application);
    await waitUntilNextIteration(interval * 60 * 1000 - (Date.now() - startedAt));
  }
}

if (require.main === module) {
  work().catch((error) => {
    console.error(error);
    throw error;
  });
}
