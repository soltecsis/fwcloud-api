import { Application } from '../../../../Application';
import { AgentCommunication } from '../../../../communications/agent.communication';
import { OpenVPNHistoryRecord } from '../../../../communications/communication';
import db from '../../../../database/database-manager';
import { FirewallInstallCommunication } from '../../../firewall/Firewall';
import { OpenVPN } from '../OpenVPN';
import { AuditEventService, AuditEventStatus } from '../../../audit/AuditEvent.service';
import { OpenVPNStatusSampling, OpenVPNStatusSamplingResult } from './openvpn-status-sampling';
import {
  CreateOpenVPNStatusHistoryData,
  CreateOpenVPNStatusHistorySummary,
  OpenVPNStatusHistoryService,
} from './openvpn-status-history.service';

const AUDIT_ENTITY = 'OpenVPNStatusHistory';

export type OpenVPNStatusWorkerIterationDependencies = {
  getOpenVPNServers: () => Promise<OpenVPN[]>;
  getSamplingConfigurations: (openVPN: OpenVPN) => Promise<OpenVPNStatusSampling[]>;
  markSamplingPollStatus: (
    samplingId: number,
    result: OpenVPNStatusSamplingResult,
    error: string | null,
  ) => Promise<void>;
};

const defaultDependencies: OpenVPNStatusWorkerIterationDependencies = {
  getOpenVPNServers: async (): Promise<OpenVPN[]> => {
    // List of all OpenVPN servers with which we have to communicate.
    return db
      .getSource()
      .getRepository(OpenVPN)
      .createQueryBuilder('openvpn')
      .innerJoin('openvpn.crt', 'crt')
      .innerJoinAndSelect('openvpn.firewall', 'firewall')
      .innerJoin(OpenVPNStatusSampling, 'sampling', 'sampling.openVPNId = openvpn.id')
      .innerJoin('sampling.collectorFirewall', 'collectorFirewall')
      .innerJoin('sampling.files', 'files')
      .where('openvpn.parentId IS NULL')
      .andWhere('crt.type = 2')
      .andWhere('sampling.enabled = :enabled', { enabled: true })
      .andWhere('collectorFirewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      })
      .getMany();
  },
  getSamplingConfigurations: async (openVPN: OpenVPN): Promise<OpenVPNStatusSampling[]> => {
    const query = db
      .getSource()
      .getRepository(OpenVPNStatusSampling)
      .createQueryBuilder('sampling')
      .innerJoinAndSelect('sampling.collectorFirewall', 'collectorFirewall')
      .innerJoinAndSelect('sampling.files', 'files')
      .where('sampling.enabled = :enabled', { enabled: true })
      .andWhere('collectorFirewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      });

    query.andWhere('sampling.openVPNId = :openvpn', { openvpn: openVPN.id });

    return query.getMany();
  },
  markSamplingPollStatus: async (
    samplingId: number,
    result: OpenVPNStatusSamplingResult,
    error: string | null,
  ): Promise<void> => {
    await db.getSource().getRepository(OpenVPNStatusSampling).update(samplingId, {
      lastPollResult: result,
      lastPollError: error,
      lastPolledAt: new Date(),
    });
  },
};

type WorkerIterationSummary = {
  processedOpenvpns: number;
  insertedEntries: number;
  updatedDisconnections: number;
  errorsCount: number;
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error === null || error === undefined) {
    return 'Unknown error';
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unserializable error object';
  }
}

function buildRecoverableErrorSummary(messages: string[]): string | null {
  if (messages.length === 0) {
    return null;
  }

  if (messages.length === 1) {
    return messages[0];
  }

  return `${messages[0]} (+${messages.length - 1} more errors)`;
}

export async function iterate(
  application: Application,
  dependencies: OpenVPNStatusWorkerIterationDependencies = defaultDependencies,
): Promise<void> {
  let auditEventService: AuditEventService | null = null;
  let eventId: string | null = null;
  const startedAt = new Date();
  let status: AuditEventStatus = 'success';
  let errorSummary: string | null = null;
  const recoverableErrors: string[] = [];
  const summary: WorkerIterationSummary = {
    processedOpenvpns: 0,
    insertedEntries: 0,
    updatedDisconnections: 0,
    errorsCount: 0,
  };

  try {
    auditEventService = await application.getService(AuditEventService.name);
    eventId = auditEventService.startEvent({
      source: 'worker',
      operation: 'sync',
      entity: AUDIT_ENTITY,
    });
    const service: OpenVPNStatusHistoryService = await application.getService(
      OpenVPNStatusHistoryService.name,
    );

    const openvpns: OpenVPN[] = await dependencies.getOpenVPNServers();

    for (const openvpn of openvpns) {
      summary.processedOpenvpns++;
      try {
        const samplingConfigurations: OpenVPNStatusSampling[] =
          await dependencies.getSamplingConfigurations(openvpn);

        let entries: CreateOpenVPNStatusHistoryData[] = [];
        for (const sampling of samplingConfigurations) {
          try {
            const statusFile = sampling.files?.[0]?.path;

            if (!statusFile) {
              throw new Error('OpenVPN status sampling has no configured status file');
            }

            const communication: AgentCommunication =
              (await sampling.collectorFirewall.getCommunication()) as AgentCommunication;
            const data: OpenVPNHistoryRecord[] =
              await communication.getOpenVPNHistoryFile(statusFile);

            entries = entries.concat(
              data.map((item) => ({
                timestampInSeconds: item.timestamp,
                name: item.name,
                address: item.address,
                bytesReceived: item.bytesReceived,
                bytesSent: item.bytesSent,
                connectedAtTimestampInSeconds: item.connectedAtTimestampInSeconds,
              })),
            );
            await dependencies.markSamplingPollStatus(sampling.id, 'success', null);
          } catch (error) {
            summary.errorsCount++;
            const errorMessage = getErrorMessage(error);
            recoverableErrors.push(
              `OpenVPN ${openvpn.id} collector ${sampling.collectorFirewallId}: ${errorMessage}`,
            );
            application
              .logger()
              .error(
                `WorkerError: OpenVPN ${openvpn.id} collector ${sampling.collectorFirewallId} failed: ${errorMessage}`,
              );
            await dependencies.markSamplingPollStatus(sampling.id, 'failed', errorMessage);
          }
        }

        const persistedEntries: CreateOpenVPNStatusHistorySummary = await service.createWithSummary(
          openvpn.id,
          entries,
        );
        summary.insertedEntries += persistedEntries.insertedEntries;
        summary.updatedDisconnections += persistedEntries.updatedDisconnections;
      } catch (error) {
        summary.errorsCount++;
        const errorMessage = getErrorMessage(error);
        recoverableErrors.push(`OpenVPN ${openvpn.id}: ${errorMessage}`);
        application.logger().error(`WorkerError: OpenVPN ${openvpn.id} failed: ${errorMessage}`);
      }
    }
  } catch (error) {
    status = 'failed';
    errorSummary = getErrorMessage(error);
    application.logger().error(`WorkerError: ${errorSummary}`);
  } finally {
    if (status === 'success') {
      errorSummary = buildRecoverableErrorSummary(recoverableErrors);
    }

    if (auditEventService && eventId) {
      await auditEventService.finishEvent(eventId, {
        affectedCount: summary.insertedEntries,
        status,
        error: status === 'failed' ? errorSummary : null,
        details: {
          source: 'worker',
          operation: 'sync',
          entity: AUDIT_ENTITY,
          processedOpenvpns: summary.processedOpenvpns,
          insertedEntries: summary.insertedEntries,
          updatedDisconnections: summary.updatedDisconnections,
          errorsCount: summary.errorsCount,
          startedAt: startedAt.toISOString(),
          status,
          error: errorSummary,
        },
      });
    }
  }
}

export async function waitUntilNextIteration(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
    if (ms <= 0) {
      return resolve();
    }

    setTimeout(() => {
      return resolve();
    }, ms);
  });
}

export async function work(): Promise<void> {
  const application = await Application.run();
  const interval: number = application.config.get('openvpn.agent.history.interval');

  application
    .logger()
    .info(`Openvpn history worker started (collection interval: ${interval} minutes).`);

  while (true) {
    const t1: number = Date.now();

    application.logger().debug(`Openvpn history worker: iterating at timestamp ${t1}`);
    await iterate(application);

    const msUntilConsumeInterval: number = interval * 60 * 1000 - (Date.now() - t1);
    application.logger().debug(`Openvpn history worker: pause of ${msUntilConsumeInterval}ms`);
    await waitUntilNextIteration(msUntilConsumeInterval);
  }
}

if (require.main === module) {
  work()
    .then(() => {})
    .catch((error) => {
      console.error(error);
      throw error;
    });
}
