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

import { EntityManager } from 'typeorm';
import { AgentCommunication } from '../../../../../src/communications/agent.communication';
import { Firewall } from '../../../../../src/models/firewall/Firewall';
import { CrowdSecLapiSharedService } from '../../../../../src/controllers/system/crowdsec/crowdsec-lapi-shared.service';
import { CrowdSecBlockingStatisticsSamplingService } from '../../../../../src/models/system/crowdsec/crowdsec-blocking-statistics-sampling.service';
import { expect } from '../../../../mocha/global-setup';
import sinon from 'sinon';

describe(CrowdSecBlockingStatisticsSamplingService.name, () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return the default configuration when a firewall has no persisted sampling', async () => {
    const manager = {
      getRepository: sinon.stub().returns({ findOne: sinon.stub().resolves(null) }),
    } as unknown as EntityManager;
    const service = new CrowdSecBlockingStatisticsSamplingService(manager);

    expect(await service.configuration(4)).to.deep.equal({
      enabled: false,
      samplingInterval: 30,
      requestMaxSamples: 1000,
      cacheMaxSize: 10485760,
    });
  });

  it('should persist the desired configuration for every cluster node and report agent failures', async () => {
    const samplingRepository = {
      findOne: sinon.stub().resolves(null),
      create: sinon.stub().callsFake((value) => value),
      save: sinon.stub().resolves(),
    };
    const manager = {
      transaction: async (callback) => callback({ getRepository: () => samplingRepository }),
    } as unknown as EntityManager;
    const service = new CrowdSecBlockingStatisticsSamplingService(manager);
    const update = sinon.stub();
    update.onFirstCall().resolves();
    sinon
      .stub(CrowdSecLapiSharedService, 'agentCommunication')
      .onFirstCall()
      .resolves({
        updateCrowdSecFirewallBouncerStatisticsSampling: update,
      } as unknown as AgentCommunication)
      .onSecondCall()
      .rejects(new Error('second node is unavailable'));

    const result = await service.update(
      [{ id: 12, name: 'node-b' } as Firewall, { id: 11, name: 'node-a' } as Firewall],
      {
        enabled: true,
        samplingInterval: 30,
        requestMaxSamples: 1000,
        cacheMaxSize: 10485760,
      },
    );

    expect(samplingRepository.save.callCount).to.equal(2);
    expect(update.calledOnce).to.equal(true);
    expect(result).to.deep.equal({
      completed: false,
      configuration: {
        enabled: true,
        samplingInterval: 30,
        requestMaxSamples: 1000,
        cacheMaxSize: 10485760,
      },
      nodes: [
        { firewall_id: 11, name: 'node-a', status: 'completed' },
        {
          firewall_id: 12,
          name: 'node-b',
          status: 'failed',
          error: 'second node is unavailable',
        },
      ],
    });
  });
});
