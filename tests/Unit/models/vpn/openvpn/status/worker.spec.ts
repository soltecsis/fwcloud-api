import sinon from 'sinon';
import { expect } from 'chai';
import { OpenVPNHistoryRecord } from '../../../../../../src/communications/communication';
import { AuditEventService } from '../../../../../../src/models/audit/AuditEvent.service';
import {
  OpenVPNStatusHistoryService,
  CreateOpenVPNStatusHistorySummary,
} from '../../../../../../src/models/vpn/openvpn/status/openvpn-status-history.service';
import {
  iterate,
  OpenVPNStatusWorkerIterationDependencies,
} from '../../../../../../src/models/vpn/openvpn/status/worker';
import { OpenVPN } from '../../../../../../src/models/vpn/openvpn/OpenVPN';
import { Firewall } from '../../../../../../src/models/firewall/Firewall';

function buildApplication(
  auditService: Pick<AuditEventService, 'startEvent' | 'finishEvent'>,
  historyService: Pick<OpenVPNStatusHistoryService, 'createWithSummary'>,
  loggerError: sinon.SinonStub,
): any {
  const getService = sinon.stub();
  getService.withArgs(AuditEventService.name).resolves(auditService);
  getService.withArgs(OpenVPNStatusHistoryService.name).resolves(historyService);

  return {
    getService,
    logger: () => ({
      error: loggerError,
      info: sinon.stub(),
      debug: sinon.stub(),
    }),
  };
}

function buildOpenVPN(
  id: number,
  firewall: Firewall,
  statusFile: string = `/tmp/status-${id}`,
): OpenVPN {
  return {
    id,
    firewall,
    openVPNOptions: [{ name: 'status', arg: statusFile }],
  } as unknown as OpenVPN;
}

function buildFirewall(records: OpenVPNHistoryRecord[]): Firewall {
  return {
    clusterId: null,
    getCommunication: async () => {
      return {
        getOpenVPNHistoryFile: async () => records,
      };
    },
  } as unknown as Firewall;
}

describe('OpenVPN status worker iteration audit events', () => {
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('emits one successful event with non-zero counters', async () => {
    const loggerError = sandbox.stub();
    const startEvent = sandbox.stub().returns('event-id');
    const finishEvent = sandbox.stub().resolves(null);
    const createWithSummary = sandbox.stub().resolves({
      entries: [],
      insertedEntries: 3,
      updatedDisconnections: 2,
    } as CreateOpenVPNStatusHistorySummary);

    const dependencies: OpenVPNStatusWorkerIterationDependencies = {
      getOpenVPNServers: async () => [
        buildOpenVPN(
          10,
          buildFirewall([
            {
              timestamp: 10,
              name: 'alice',
              address: '10.0.0.2',
              bytesReceived: 100,
              bytesSent: 200,
              connectedAtTimestampInSeconds: 1,
            },
          ]),
        ),
      ],
    };

    await iterate(
      buildApplication(
        { startEvent, finishEvent } as Pick<AuditEventService, 'startEvent' | 'finishEvent'>,
        {
          createWithSummary,
        } as Pick<OpenVPNStatusHistoryService, 'createWithSummary'>,
        loggerError,
      ),
      dependencies,
    );

    expect(startEvent.callCount).to.equal(1);
    expect(finishEvent.callCount).to.equal(1);
    expect(createWithSummary.callCount).to.equal(1);

    expect(startEvent.firstCall.args[0]).to.deep.include({
      source: 'worker',
      operation: 'sync',
      entity: 'OpenVPNStatusHistory',
    });

    const finishPayload = finishEvent.firstCall.args[1];
    expect(finishPayload.status).to.equal('success');
    expect(finishPayload.affectedCount).to.equal(3);
    expect(finishPayload.details.processedOpenvpns).to.equal(1);
    expect(finishPayload.details.insertedEntries).to.equal(3);
    expect(finishPayload.details.updatedDisconnections).to.equal(2);
    expect(finishPayload.details.errorsCount).to.equal(0);
    expect(finishPayload.details.error).to.equal(null);
    expect(loggerError.callCount).to.equal(0);
  });

  it('keeps status success with recoverable per-openvpn errors', async () => {
    const loggerError = sandbox.stub();
    const startEvent = sandbox.stub().returns('event-id');
    const finishEvent = sandbox.stub().resolves(null);
    const createWithSummary = sandbox.stub();
    createWithSummary.onFirstCall().rejects(new Error('sync item failed'));
    createWithSummary.onSecondCall().resolves({
      entries: [],
      insertedEntries: 5,
      updatedDisconnections: 1,
    } as CreateOpenVPNStatusHistorySummary);

    const dependencies: OpenVPNStatusWorkerIterationDependencies = {
      getOpenVPNServers: async () => [
        buildOpenVPN(
          10,
          buildFirewall([
            {
              timestamp: 10,
              name: 'alice',
              address: '10.0.0.2',
              bytesReceived: 100,
              bytesSent: 200,
              connectedAtTimestampInSeconds: 1,
            },
          ]),
        ),
        buildOpenVPN(
          11,
          buildFirewall([
            {
              timestamp: 11,
              name: 'bob',
              address: '10.0.0.3',
              bytesReceived: 110,
              bytesSent: 210,
              connectedAtTimestampInSeconds: 2,
            },
          ]),
        ),
      ],
    };

    await iterate(
      buildApplication(
        { startEvent, finishEvent } as Pick<AuditEventService, 'startEvent' | 'finishEvent'>,
        {
          createWithSummary,
        } as Pick<OpenVPNStatusHistoryService, 'createWithSummary'>,
        loggerError,
      ),
      dependencies,
    );

    expect(startEvent.callCount).to.equal(1);
    expect(finishEvent.callCount).to.equal(1);
    expect(createWithSummary.callCount).to.equal(2);

    const finishPayload = finishEvent.firstCall.args[1];
    expect(finishPayload.status).to.equal('success');
    expect(finishPayload.error).to.equal(null);
    expect(finishPayload.affectedCount).to.equal(5);
    expect(finishPayload.details.processedOpenvpns).to.equal(2);
    expect(finishPayload.details.insertedEntries).to.equal(5);
    expect(finishPayload.details.updatedDisconnections).to.equal(1);
    expect(finishPayload.details.errorsCount).to.equal(1);
    expect(finishPayload.details.error).to.contain('OpenVPN 10: sync item failed');
    expect(loggerError.callCount).to.equal(1);
  });

  it('emits status failed when the iteration aborts with a hard error', async () => {
    const loggerError = sandbox.stub();
    const startEvent = sandbox.stub().returns('event-id');
    const finishEvent = sandbox.stub().resolves(null);
    const createWithSummary = sandbox.stub();

    const dependencies: OpenVPNStatusWorkerIterationDependencies = {
      getOpenVPNServers: async () => {
        throw new Error('hard failure');
      },
    };

    await iterate(
      buildApplication(
        { startEvent, finishEvent } as Pick<AuditEventService, 'startEvent' | 'finishEvent'>,
        {
          createWithSummary,
        } as Pick<OpenVPNStatusHistoryService, 'createWithSummary'>,
        loggerError,
      ),
      dependencies,
    );

    expect(startEvent.callCount).to.equal(1);
    expect(finishEvent.callCount).to.equal(1);
    expect(createWithSummary.callCount).to.equal(0);

    const finishPayload = finishEvent.firstCall.args[1];
    expect(finishPayload.status).to.equal('failed');
    expect(finishPayload.error).to.equal('hard failure');
    expect(finishPayload.details.status).to.equal('failed');
    expect(finishPayload.details.error).to.equal('hard failure');
    expect(finishPayload.details.errorsCount).to.equal(0);
    expect(loggerError.callCount).to.equal(1);
  });

  it('uses the OpenVPN firewall and status option', async () => {
    const loggerError = sandbox.stub();
    const startEvent = sandbox.stub().returns('event-id');
    const finishEvent = sandbox.stub().resolves(null);
    const createWithSummary = sandbox.stub().resolves({
      entries: [],
      insertedEntries: 1,
      updatedDisconnections: 0,
    } as CreateOpenVPNStatusHistorySummary);
    const openVPNFirewall = buildFirewall([
      {
        timestamp: 10,
        name: 'alice',
        address: '10.0.0.2',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: 1,
      },
    ]);

    const dependencies: OpenVPNStatusWorkerIterationDependencies = {
      getOpenVPNServers: async () => [buildOpenVPN(10, openVPNFirewall, '/tmp/openvpn-status')],
    };

    await iterate(
      buildApplication(
        { startEvent, finishEvent } as Pick<AuditEventService, 'startEvent' | 'finishEvent'>,
        {
          createWithSummary,
        } as Pick<OpenVPNStatusHistoryService, 'createWithSummary'>,
        loggerError,
      ),
      dependencies,
    );

    expect(createWithSummary.firstCall.args[1]).to.have.length(1);
    expect(createWithSummary.firstCall.args[1][0].name).to.equal('alice');
  });

  it('continues with the next OpenVPN server when polling fails', async () => {
    const loggerError = sandbox.stub();
    const startEvent = sandbox.stub().returns('event-id');
    const finishEvent = sandbox.stub().resolves(null);
    const createWithSummary = sandbox.stub().resolves({
      entries: [],
      insertedEntries: 1,
      updatedDisconnections: 0,
    } as CreateOpenVPNStatusHistorySummary);
    const failingFirewall = {
      getCommunication: async () => ({
        getOpenVPNHistoryFile: async () => {
          throw new Error('agent unavailable');
        },
      }),
    } as unknown as Firewall;
    const workingFirewall = buildFirewall([
      {
        timestamp: 10,
        name: 'alice',
        address: '10.0.0.2',
        bytesReceived: 100,
        bytesSent: 200,
        connectedAtTimestampInSeconds: 1,
      },
    ]);

    const dependencies: OpenVPNStatusWorkerIterationDependencies = {
      getOpenVPNServers: async () => [
        buildOpenVPN(10, failingFirewall),
        buildOpenVPN(11, workingFirewall),
      ],
    };

    await iterate(
      buildApplication(
        { startEvent, finishEvent } as Pick<AuditEventService, 'startEvent' | 'finishEvent'>,
        {
          createWithSummary,
        } as Pick<OpenVPNStatusHistoryService, 'createWithSummary'>,
        loggerError,
      ),
      dependencies,
    );

    expect(createWithSummary.callCount).to.equal(1);
    expect(createWithSummary.firstCall.args[0]).to.equal(11);
    expect(createWithSummary.firstCall.args[1]).to.have.length(1);
    expect(finishEvent.firstCall.args[1].details.errorsCount).to.equal(1);
  });
});
