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

import sinon from 'sinon';
import { AgentCommunication } from '../../../../../src/communications/agent.communication';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { AuditEventService } from '../../../../../src/models/audit/AuditEvent.service';
import { CrowdSecBlockingStatisticsService } from '../../../../../src/models/system/crowdsec/crowdsec-blocking-statistics.service';
import { CrowdSecLapiSharedService } from '../../../../../src/controllers/system/crowdsec/crowdsec-lapi-shared.service';
import {
  CrowdSecBlockingStatisticsWorkerDependencies,
  iterate,
} from '../../../../../src/models/system/crowdsec/crowdsec-blocking-statistics.worker';
import { expect } from '../../../../mocha/global-setup';

describe('CrowdSec blocking statistics worker', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should persist all cached samples returned by an enabled firewall agent', async () => {
    const startEvent = sinon.stub().returns('event-id');
    const finishEvent = sinon.stub().resolves();
    const create = sinon.stub().resolves(1);
    const takeCrowdSecFirewallBouncerStatistics = sinon.stub().resolves({
      state: 'available',
      samples: [
        {
          collectedAt: '2026-10-20T10:00:00.000Z',
          policyGeneration: 1,
          ipv4Input: { packets: 10, bytes: 1000 },
          ipv4Forward: { packets: 0, bytes: 0 },
          ipv6Input: { packets: 0, bytes: 0 },
          ipv6Forward: { packets: 0, bytes: 0 },
          addresses: [],
        },
      ],
    });
    sinon.stub(CrowdSecLapiSharedService, 'agentCommunication').resolves({
      takeCrowdSecFirewallBouncerStatistics,
    } as unknown as AgentCommunication);
    const getService = sinon.stub();
    getService
      .withArgs(AuditEventService.name)
      .resolves({ startEvent, finishEvent } as Pick<
        AuditEventService,
        'startEvent' | 'finishEvent'
      >);
    getService
      .withArgs(CrowdSecBlockingStatisticsService.name)
      .resolves({ create } as Pick<CrowdSecBlockingStatisticsService, 'create'>);
    const application = {
      getService,
      logger: () => ({ error: sinon.stub(), info: sinon.stub() }),
    } as any;
    const dependencies: CrowdSecBlockingStatisticsWorkerDependencies = {
      getFirewalls: async () => [{ id: 8, name: 'firewall-a' } as Firewall],
    };

    await iterate(application, dependencies);

    expect(takeCrowdSecFirewallBouncerStatistics.calledOnce).to.equal(true);
    expect(create.firstCall.args[0]).to.equal(8);
    expect(create.firstCall.args[1]).to.have.lengthOf(1);
    expect(finishEvent.firstCall.args[1]).to.deep.include({
      affectedCount: 1,
      status: 'success',
    });
  });
});
