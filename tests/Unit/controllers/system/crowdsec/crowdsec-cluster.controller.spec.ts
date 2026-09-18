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
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { EventEmitter } from 'events';
import { Request } from 'express';
import sinon from 'sinon';
import { AgentCommunication } from '../../../../../src/communications/agent.communication';
import { Application } from '../../../../../src/Application';
import { CrowdSecClusterController } from '../../../../../src/controllers/system/crowdsec/crowdsec-cluster.controller';
import { Authorization } from '../../../../../src/fonaments/authorization/policy';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../../../../../src/models/firewall/Firewall';
import { Cluster } from '../../../../../src/models/firewall/Cluster';
import { CrowdSecInstallationRepository } from '../../../../../src/models/system/crowdsec/crowdsec.repository';
import { FirewallRepository } from '../../../../../src/models/firewall/firewall.repository';
import { CrowdSecPolicy } from '../../../../../src/policies/crowdsec.policy';
import { Channel } from '../../../../../src/sockets/channels/channel';
import { describeName, expect, testSuite } from '../../../../mocha/global-setup';
import db from '../../../../../src/database/database-manager';
import {
  CrowdSecInstallation,
  CrowdSecInstallationMode,
} from '../../../../../src/models/system/crowdsec/crowdsec-installation.model';

describe(describeName(CrowdSecClusterController.name + ' Unit Tests'), () => {
  let app: Application;
  let controller: CrowdSecClusterController;
  let centralFirewall: Firewall;
  let firstNode: Firewall;
  let secondNode: Firewall;
  let centralCommunication: AgentCommunication;
  let firstCommunication: AgentCommunication;
  let secondCommunication: AgentCommunication;
  let managePolicyStub: sinon.SinonStub;
  let saveMachineInstallationStub: sinon.SinonStub;
  let configureCentralLapiStub: sinon.SinonStub;
  let setCentralLapiEnabledStub: sinon.SinonStub;
  let validateCrowdSecLapiMachineStub: sinon.SinonStub;

  beforeEach(async () => {
    app = testSuite.app;
    await testSuite.resetDatabaseData();
    controller = new CrowdSecClusterController(app);
    centralFirewall = firewall(10, 'central-lapi', null);
    firstNode = firewall(11, 'cluster-master', 5);
    secondNode = firewall(12, 'cluster-slave', 5);
    centralCommunication = communication('https', '192.0.2.10');
    firstCommunication = communication('https', '192.0.2.11');
    secondCommunication = communication('https', '192.0.2.12');

    (centralFirewall as any).getCommunication = async () => centralCommunication;
    (firstNode as any).getCommunication = async () => firstCommunication;
    (secondNode as any).getCommunication = async () => secondCommunication;
    (controller as any)._cluster = Object.assign(new Cluster(), {
      id: 5,
      fwCloudId: 1,
      firewalls: [secondNode, firstNode],
    });

    managePolicyStub = sinon.stub(CrowdSecPolicy, 'manage').resolves(Authorization.grant());
    sinon.stub(db.getSource().manager.getRepository(Firewall), 'findOne').resolves(centralFirewall);
    sinon
      .stub(CrowdSecInstallationRepository.prototype, 'findByFirewallId')
      .callsFake(async (firewallId: number) =>
        firewallId === centralFirewall.id
          ? Object.assign(new CrowdSecInstallation(), {
              mode: CrowdSecInstallationMode.Standalone,
            })
          : null,
      );
    sinon.stub(CrowdSecInstallationRepository.prototype, 'hasMachineDependents').resolves(false);
    setCentralLapiEnabledStub = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'setCentralLapiEnabled')
      .resolves(new CrowdSecInstallation());
    saveMachineInstallationStub = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'saveMachineInstallation')
      .resolves(new CrowdSecInstallation());
    sinon
      .stub(FirewallRepository.prototype, 'setCrowdSecCompatibility')
      .callsFake(async (firewall: Firewall) => firewall);
    sinon.stub(Firewall, 'getCrowdSecFirewallBouncerBackend').resolves('iptables');
    sinon
      .stub(Channel, 'fromRequest')
      .resolves(new Channel('crowdsec-cluster', new EventEmitter()));
    configureCentralLapiStub = sinon
      .stub(centralCommunication, 'configureCrowdSecCentralLapi')
      .resolves({ listen_uri: '0.0.0.0:8080' });
    validateCrowdSecLapiMachineStub = sinon
      .stub(centralCommunication, 'validateCrowdSecLapiMachine')
      .resolves({});
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should install every cluster node sequentially and persist independent Machines', async () => {
    const firstInstall = sinon.stub(firstCommunication, 'installCrowdSecMachine').resolves({});
    const secondInstall = sinon.stub(secondCommunication, 'installCrowdSecMachine').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecMachine').resolves({});
    sinon.stub(secondCommunication, 'activateCrowdSecMachine').resolves({});

    const response = await controller.installMachine(request());

    expect(firstInstall.calledOnce).to.be.true;
    expect(secondInstall.calledOnce).to.be.true;
    expect(firstInstall.calledBefore(secondInstall)).to.be.true;
    expect(
      saveMachineInstallationStub.calledWithMatch({
        firewallId: firstNode.id,
        centralFirewallId: centralFirewall.id,
        machineName: 'fwcloud-cluster-master',
      }),
    ).to.be.true;
    expect(
      saveMachineInstallationStub.calledWithMatch({
        firewallId: secondNode.id,
        centralFirewallId: centralFirewall.id,
        machineName: 'fwcloud-cluster-slave',
      }),
    ).to.be.true;
    expect(response.toJSON()).to.include({ status: 200 });
    expect(response.toJSON().data).to.deep.equal({
      completed: true,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'completed',
        },
        {
          firewall_id: secondNode.id,
          name: secondNode.name,
          machine_name: 'fwcloud-cluster-slave',
          status: 'completed',
        },
      ],
    });
  });

  it('should require confirmation before changing cluster nodes without LAPI connectivity', async () => {
    const firstInstall = sinon.stub(firstCommunication, 'installCrowdSecMachine').resolves({
      installation_state: 'connectivity_confirmation_required',
    });
    const secondInstall = sinon.stub(secondCommunication, 'installCrowdSecMachine');

    const response = await controller.installMachine(request());

    expect(firstInstall.calledOnce).to.be.true;
    expect(secondInstall.called).to.be.false;
    expect(setCentralLapiEnabledStub.called).to.be.false;
    expect(saveMachineInstallationStub.called).to.be.false;
    expect(validateCrowdSecLapiMachineStub.called).to.be.false;
    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      connectivity_confirmation_required: true,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'connectivity_confirmation_required',
        },
      ],
    });
  });

  it('should retain a completed node when a later node installation fails', async () => {
    sinon.stub(firstCommunication, 'installCrowdSecMachine').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecMachine').resolves({});
    sinon
      .stub(secondCommunication, 'installCrowdSecMachine')
      .rejects(new Error('Node unavailable'));
    const removeMachine = sinon
      .stub(centralCommunication, 'removeCrowdSecLapiMachine')
      .resolves({});

    const response = await controller.installMachine(request());

    expect(
      saveMachineInstallationStub.calledOnce &&
        saveMachineInstallationStub.calledWithMatch({
          firewallId: firstNode.id,
        }),
    ).to.be.true;
    expect(removeMachine.calledOnceWithExactly('fwcloud-cluster-slave')).to.be.true;
    expect(response.toJSON()).to.include({ status: 200 });
    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'completed',
        },
        {
          firewall_id: secondNode.id,
          name: secondNode.name,
          machine_name: 'fwcloud-cluster-slave',
          status: 'failed',
          error: 'Node unavailable',
        },
      ],
    });
  });

  it('should reject unauthorized cluster Machine installation before contacting agents', async () => {
    managePolicyStub.resolves(Authorization.revoke());

    await expect(controller.installMachine(request())).to.be.rejected;
    expect(configureCentralLapiStub.called).to.be.false;
  });
});

function firewall(id: number, name: string, clusterId: number | null): Firewall {
  return Object.assign(new Firewall(), {
    id,
    name,
    fwCloudId: 1,
    clusterId,
    install_communication: FirewallInstallCommunication.Agent,
    install_protocol: FirewallInstallProtocol.HTTPS,
  });
}

function communication(protocol: 'http' | 'https', host: string): AgentCommunication {
  return new AgentCommunication({ protocol, host, port: 33033, apikey: 'api-key' });
}

function request(): Request {
  return {
    body: {
      centralFirewallId: 10,
      lapiUrl: 'http://192.0.2.10:8080',
      localRemediation: false,
    },
    session: { user: null },
  } as unknown as Request;
}
