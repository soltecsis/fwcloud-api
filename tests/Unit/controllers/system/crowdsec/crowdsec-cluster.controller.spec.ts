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
import { CrowdSecClusterTransitionDto } from '../../../../../src/controllers/system/crowdsec/dto/cluster-transition.dto';
import { ValidationException } from '../../../../../src/fonaments/exceptions/validation-exception';
import { Validator } from '../../../../../src/fonaments/validation/validator';
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
  let setCrowdSecCompatibilityStub: sinon.SinonStub;
  let configureCentralLapiStub: sinon.SinonStub;
  let setCentralLapiEnabledStub: sinon.SinonStub;
  let validateCrowdSecLapiMachineStub: sinon.SinonStub;
  let centralPingStub: sinon.SinonStub;
  let findByFirewallIdStub: sinon.SinonStub;
  let findCentralFirewallStub: sinon.SinonStub;
  let restoreInstallationStub: sinon.SinonStub;
  let replicateMachineStub: sinon.SinonStub;
  let replicateBouncerStub: sinon.SinonStub;

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
    findCentralFirewallStub = sinon
      .stub(db.getSource().manager.getRepository(Firewall), 'findOne')
      .resolves(centralFirewall);
    findByFirewallIdStub = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'findByFirewallId')
      .callsFake(async (firewallId: number) =>
        firewallId === centralFirewall.id
          ? Object.assign(new CrowdSecInstallation(), {
              mode: CrowdSecInstallationMode.Lapi,
            })
          : null,
      );
    sinon.stub(CrowdSecInstallationRepository.prototype, 'hasMachineDependents').resolves(false);
    restoreInstallationStub = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'restoreInstallation')
      .resolves(new CrowdSecInstallation());
    setCentralLapiEnabledStub = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'setCentralLapiEnabled')
      .resolves(new CrowdSecInstallation());
    saveMachineInstallationStub = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'saveMachineInstallation')
      .resolves(new CrowdSecInstallation());
    setCrowdSecCompatibilityStub = sinon
      .stub(FirewallRepository.prototype, 'setCrowdSecCompatibility')
      .callsFake(async (firewall: Firewall) => firewall);
    sinon.stub(Firewall, 'getCrowdSecFirewallBouncerBackend').resolves('iptables');
    sinon
      .stub(Channel, 'fromRequest')
      .resolves(new Channel('crowdsec-cluster', new EventEmitter()));
    configureCentralLapiStub = sinon
      .stub(centralCommunication, 'configureCrowdSecCentralLapi')
      .resolves({ listen_uri: '0.0.0.0:8080' });
    centralPingStub = sinon.stub(AgentCommunication.prototype, 'ping').resolves();
    sinon
      .stub(AgentCommunication.prototype, 'getCrowdSecLapiReplicationReadiness')
      .resolves({ ready: true });
    sinon
      .stub(AgentCommunication.prototype, 'exportCrowdSecMachineCredentials')
      .callsFake(async (name: string) => ({ login: name, password: 'machine-password' }));
    replicateMachineStub = sinon
      .stub(AgentCommunication.prototype, 'replicateCrowdSecLapiMachine')
      .resolves({});
    replicateBouncerStub = sinon
      .stub(AgentCommunication.prototype, 'replicateCrowdSecLapiBouncer')
      .resolves({});
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
    expect(setCrowdSecCompatibilityStub.calledWith(firstNode, false)).to.be.true;
    expect(setCrowdSecCompatibilityStub.calledWith(secondNode, false)).to.be.true;
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
      central_lapi_nodes: [
        {
          firewall_id: centralFirewall.id,
          name: centralFirewall.name,
        },
      ],
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
      central_lapi_nodes: [
        {
          firewall_id: centralFirewall.id,
          name: centralFirewall.name,
        },
      ],
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

  it('should require confirmation when the central LAPI agent is unreachable', async () => {
    const firstInstall = sinon.stub(firstCommunication, 'installCrowdSecMachine');
    centralPingStub.rejects(new Error('Central agent is unavailable'));

    const response = await controller.installMachine(request());

    expect(configureCentralLapiStub.called).to.be.false;
    expect(firstInstall.called).to.be.false;
    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      connectivity_confirmation_required: true,
      connectivity_confirmation_reason: 'central_agent_unreachable',
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
      central_lapi_nodes: [
        {
          firewall_id: centralFirewall.id,
          name: centralFirewall.name,
        },
      ],
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

  it('should retry only the selected failed cluster nodes', async () => {
    const firstInstall = sinon.stub(firstCommunication, 'installCrowdSecMachine');
    const secondInstall = sinon.stub(secondCommunication, 'installCrowdSecMachine').resolves({});
    sinon.stub(secondCommunication, 'activateCrowdSecMachine').resolves({});

    const response = await controller.installMachine(request({ nodeIds: [secondNode.id] }));

    expect(firstInstall.called).to.be.false;
    expect(secondInstall.calledOnce).to.be.true;
    expect(
      saveMachineInstallationStub.calledOnce &&
        saveMachineInstallationStub.calledWithMatch({ firewallId: secondNode.id }),
    ).to.be.true;
    expect(response.toJSON().data).to.deep.equal({
      completed: true,
      central_lapi_nodes: [
        {
          firewall_id: centralFirewall.id,
          name: centralFirewall.name,
        },
      ],
      nodes: [
        {
          firewall_id: secondNode.id,
          name: secondNode.name,
          machine_name: 'fwcloud-cluster-slave',
          status: 'completed',
        },
      ],
    });
  });

  it('should transition LAPI cluster nodes to Machines sequentially', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) => {
      if (firewallId === centralFirewall.id) {
        return Object.assign(new CrowdSecInstallation(), { mode: CrowdSecInstallationMode.Lapi });
      }
      if (firewallId === firstNode.id || firewallId === secondNode.id) {
        return Object.assign(new CrowdSecInstallation(), { mode: CrowdSecInstallationMode.Lapi });
      }
      return null;
    });
    const prepare = sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'finalizeCrowdSecTransition').resolves({});
    const secondPrepare = sinon.stub(secondCommunication, 'prepareCrowdSecTransition');

    const response = await controller.transitionRole(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
      }),
    );

    expect(prepare.calledOnce).to.be.true;
    expect(secondPrepare.called).to.be.false;
    expect(
      saveMachineInstallationStub.calledOnce &&
        saveMachineInstallationStub.calledWithMatch({
          firewallId: firstNode.id,
          centralFirewallId: centralFirewall.id,
          machineName: 'fwcloud-cluster-master',
          localRemediation: false,
        }),
    ).to.be.true;
    expect(response.toJSON().data).to.deep.equal({
      completed: true,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'completed',
        },
      ],
    });
  });

  it('should transition Machine cluster nodes to LAPI installations', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) =>
      firewallId === centralFirewall.id
        ? lapiInstallation(centralFirewall.id)
        : firewallId === firstNode.id
          ? machineInstallation(firstNode.id, 'fwcloud-cluster-master', true)
          : null,
    );
    const prepare = sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'finalizeCrowdSecTransition').resolves({});
    const saveLapiInstallation = sinon
      .stub(CrowdSecInstallationRepository.prototype, 'saveLapiInstallation')
      .resolves(lapiInstallation(firstNode.id));
    const removeMachine = sinon
      .stub(centralCommunication, 'removeCrowdSecLapiMachine')
      .resolves({});

    const response = await controller.transitionRole(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Lapi,
        localRemediation: true,
        centralFirewallId: undefined,
        lapiUrl: undefined,
      }),
    );

    expect(prepare.calledOnce).to.be.true;
    expect(saveLapiInstallation.calledOnceWithExactly(firstNode.id)).to.be.true;
    expect(removeMachine.calledOnceWithExactly('fwcloud-cluster-master')).to.be.true;
    expect(setCrowdSecCompatibilityStub.calledWith(firstNode, true)).to.be.true;
    expect(response.toJSON().data).to.deep.equal({
      completed: true,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'completed',
          source_machine_removed: true,
          source_bouncer_cleanup_required: true,
        },
      ],
    });
  });

  it('should move Machine nodes to another central LAPI', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    const targetCentralFirewall = firewall(20, 'target-central-lapi', null);
    const targetCommunication = communication('https', '192.0.2.20');
    (targetCentralFirewall as any).getCommunication = async () => targetCommunication;
    findCentralFirewallStub.callsFake(async (options: { where: { id: number } }) =>
      options.where.id === targetCentralFirewall.id ? targetCentralFirewall : centralFirewall,
    );
    findByFirewallIdStub.callsFake(async (firewallId: number) => {
      if (firewallId === centralFirewall.id || firewallId === targetCentralFirewall.id) {
        return lapiInstallation(firewallId);
      }
      return firewallId === firstNode.id
        ? machineInstallation(firstNode.id, 'fwcloud-cluster-master', false)
        : null;
    });
    sinon.stub(targetCommunication, 'configureCrowdSecCentralLapi').resolves({});
    const prepare = sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'finalizeCrowdSecTransition').resolves({});
    sinon.stub(centralCommunication, 'removeCrowdSecLapiMachine').resolves({});

    const response = await controller.transitionMachineCentralLapi(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
        centralFirewallId: targetCentralFirewall.id,
        lapiUrl: 'http://192.0.2.20:8080',
        localRemediation: false,
      }),
    );

    expect(prepare.calledOnce).to.be.true;
    expect(
      saveMachineInstallationStub.calledOnce &&
        saveMachineInstallationStub.calledWithMatch({
          firewallId: firstNode.id,
          centralFirewallId: targetCentralFirewall.id,
          lapiUrl: 'http://192.0.2.20:8080',
        }),
    ).to.be.true;
    expect(response.toJSON().data).to.include({ completed: true });
  });

  it('should change the central LAPI address for Machine nodes', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) =>
      firewallId === centralFirewall.id
        ? lapiInstallation(centralFirewall.id)
        : firewallId === firstNode.id
          ? machineInstallation(firstNode.id, 'fwcloud-cluster-master', false)
          : null,
    );
    sinon
      .stub(CrowdSecInstallationRepository.prototype, 'hasMachineDependentsExcept')
      .resolves(false);
    const prepare = sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'finalizeCrowdSecTransition').resolves({});

    const response = await controller.transitionMachineAddress(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
        lapiUrl: 'http://192.0.2.10:8181',
      }),
    );

    expect(prepare.calledOnce).to.be.true;
    expect(configureCentralLapiStub.calledOnce).to.be.true;
    expect(
      saveMachineInstallationStub.calledOnce &&
        saveMachineInstallationStub.calledWithMatch({
          firewallId: firstNode.id,
          lapiUrl: 'http://192.0.2.10:8181',
        }),
    ).to.be.true;
    expect(response.toJSON().data).to.include({ completed: true });
  });

  it('should enable remediation for Machine nodes', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) =>
      firewallId === centralFirewall.id
        ? lapiInstallation(centralFirewall.id)
        : firewallId === firstNode.id
          ? machineInstallation(firstNode.id, 'fwcloud-cluster-master', false)
          : null,
    );
    const prepare = sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'finalizeCrowdSecTransition').resolves({});

    const response = await controller.transitionRemediation(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
        centralFirewallId: undefined,
        lapiUrl: undefined,
        localRemediation: true,
      }),
    );

    expect(prepare.calledOnce).to.be.true;
    expect(
      saveMachineInstallationStub.calledOnce &&
        saveMachineInstallationStub.calledWithMatch({
          firewallId: firstNode.id,
          localRemediation: true,
        }),
    ).to.be.true;
    expect(setCrowdSecCompatibilityStub.calledWith(firstNode, true)).to.be.true;
    expect(response.toJSON().data).to.include({ completed: true });
  });

  it('should validate cluster remediation without a central LAPI target', async () => {
    await expect(
      new Validator(
        {
          confirm: true,
          mode: CrowdSecInstallationMode.Machine,
          localRemediation: true,
        },
        CrowdSecClusterTransitionDto,
      ).validate(),
    ).to.be.fulfilled;
    await expect(
      new Validator(
        {
          confirm: true,
          mode: CrowdSecInstallationMode.Machine,
          localRemediation: true,
          centralFirewallId: 0,
        },
        CrowdSecClusterTransitionDto,
      ).validate(),
    ).to.be.rejectedWith(ValidationException);
  });

  it('should require a central LAPI target when transitioning a cluster to Machine mode', async () => {
    await expect(
      controller.transitionRole(
        request({
          confirm: true,
          mode: CrowdSecInstallationMode.Machine,
          centralFirewallId: undefined,
          lapiUrl: undefined,
        }),
      ),
    ).to.be.rejectedWith('Invalid CrowdSec cluster role transition target');
    expect(configureCentralLapiStub.called).to.be.false;
  });

  it('should reject selecting individual nodes for a cluster transition', async () => {
    await expect(
      controller.transitionRemediation(
        request({
          confirm: true,
          mode: CrowdSecInstallationMode.Machine,
          centralFirewallId: undefined,
          lapiUrl: undefined,
          localRemediation: true,
          nodeIds: [firstNode.id],
        }),
      ),
    ).to.be.rejectedWith('CrowdSec cluster transitions must include every cluster node');
  });

  it('should roll back activated nodes after a later cluster transition failure', async () => {
    findByFirewallIdStub.callsFake(async (firewallId: number) => {
      if (firewallId === centralFirewall.id) {
        return lapiInstallation(centralFirewall.id);
      }
      return firewallId === firstNode.id || firewallId === secondNode.id
        ? lapiInstallation(firewallId)
        : null;
    });
    sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'finalizeCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'recoverCrowdSecTransition').resolves({});
    sinon.stub(secondCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon
      .stub(secondCommunication, 'activateCrowdSecTransition')
      .rejects(new Error('Activation failed'));
    sinon
      .stub(secondCommunication, 'recoverCrowdSecTransition')
      .rejects(new Error('Recovery failed'));
    sinon.stub(centralCommunication, 'removeCrowdSecLapiMachine').resolves({});

    const response = await controller.transitionRole(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
      }),
    );

    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'rolled_back',
          central_machine_cleanup_required: true,
        },
        {
          firewall_id: secondNode.id,
          name: secondNode.name,
          machine_name: 'fwcloud-cluster-slave',
          status: 'rollback_failed',
          central_machine_cleanup_required: true,
          error: 'CrowdSec node rollback failed and requires manual recovery',
        },
      ],
    });
  });

  it('should cancel untouched cluster nodes after a transition failure', async () => {
    findByFirewallIdStub.callsFake(async (firewallId: number) => {
      if (firewallId === centralFirewall.id) {
        return lapiInstallation(centralFirewall.id);
      }
      return firewallId === firstNode.id || firewallId === secondNode.id
        ? lapiInstallation(firewallId)
        : null;
    });
    sinon
      .stub(firstCommunication, 'prepareCrowdSecTransition')
      .rejects(new Error('Preparation failed'));
    const secondPrepare = sinon.stub(secondCommunication, 'prepareCrowdSecTransition');
    sinon.stub(centralCommunication, 'removeCrowdSecLapiMachine').resolves({});

    const response = await controller.transitionRole(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
      }),
    );

    expect(secondPrepare.called).to.be.false;
    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'failed',
          error: 'Preparation failed',
        },
        {
          firewall_id: secondNode.id,
          name: secondNode.name,
          machine_name: 'fwcloud-cluster-slave',
          status: 'cancelled',
          error: 'CrowdSec cluster transition was cancelled after a previous node failed',
        },
      ],
    });
  });

  it('should restore every affected node after Machine credential replication fails', async () => {
    findByFirewallIdStub.callsFake(async (firewallId: number) => {
      if (firewallId === centralFirewall.id) {
        return lapiInstallation(centralFirewall.id);
      }
      return firewallId === firstNode.id || firewallId === secondNode.id
        ? lapiInstallation(firewallId)
        : null;
    });
    sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    const activate = sinon.stub(firstCommunication, 'activateCrowdSecTransition');
    const recover = sinon.stub(firstCommunication, 'recoverCrowdSecTransition').resolves({});
    replicateMachineStub.rejects(new Error('Machine replication failed'));

    const response = await controller.transitionRole(
      request({ confirm: true, mode: CrowdSecInstallationMode.Machine }),
    );

    expect(activate.called).to.be.false;
    expect(recover.called).to.be.true;
    expect(
      restoreInstallationStub.calledWithMatch({
        firewallId: firstNode.id,
        mode: CrowdSecInstallationMode.Lapi,
      }),
    ).to.be.true;
    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'rolled_back',
          central_machine_cleanup_required: true,
          error: 'Machine replication failed',
        },
        {
          firewall_id: secondNode.id,
          name: secondNode.name,
          machine_name: 'fwcloud-cluster-slave',
          status: 'cancelled',
          error: 'CrowdSec cluster transition was cancelled after a previous node failed',
        },
      ],
    });
  });

  it('should restore the initial state when Machine persistence fails after activation', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) =>
      firewallId === centralFirewall.id || firewallId === firstNode.id
        ? lapiInstallation(firewallId)
        : null,
    );
    sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'recoverCrowdSecTransition').resolves({});
    saveMachineInstallationStub.rejects(new Error('Persistence failed'));

    const response = await controller.transitionRole(
      request({ confirm: true, mode: CrowdSecInstallationMode.Machine }),
    );

    expect(
      restoreInstallationStub.calledWithMatch({
        firewallId: firstNode.id,
        mode: CrowdSecInstallationMode.Lapi,
      }),
    ).to.be.true;
    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'rolled_back',
          central_machine_cleanup_required: true,
          error: 'Persistence failed',
        },
      ],
    });
  });

  it('should report finalization failures without rolling back completed nodes', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) =>
      firewallId === centralFirewall.id || firewallId === firstNode.id
        ? lapiInstallation(firewallId)
        : null,
    );
    sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'activateCrowdSecTransition').resolves({});
    sinon
      .stub(firstCommunication, 'finalizeCrowdSecTransition')
      .rejects(new Error('Finalization failed'));
    const recover = sinon.stub(firstCommunication, 'recoverCrowdSecTransition');

    const response = await controller.transitionRole(
      request({ confirm: true, mode: CrowdSecInstallationMode.Machine }),
    );

    expect(recover.called).to.be.false;
    expect(restoreInstallationStub.called).to.be.false;
    expect(response.toJSON().data).to.deep.equal({
      completed: true,
      finalization_incomplete: true,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'finalization_failed',
          error: 'Finalization failed',
        },
      ],
    });
  });

  it('should retain central Bouncer replicas for manual cleanup after replication fails', async () => {
    (controller as any)._cluster.firewalls = [firstNode];
    findByFirewallIdStub.callsFake(async (firewallId: number) =>
      firewallId === centralFirewall.id || firewallId === firstNode.id
        ? lapiInstallation(firewallId)
        : null,
    );
    sinon.stub(firstCommunication, 'prepareCrowdSecTransition').resolves({});
    sinon.stub(firstCommunication, 'recoverCrowdSecTransition').resolves({});
    replicateBouncerStub.rejects(new Error('Bouncer replication failed'));

    const response = await controller.transitionRole(
      request({
        confirm: true,
        mode: CrowdSecInstallationMode.Machine,
        localRemediation: true,
      }),
    );

    expect(response.toJSON().data).to.deep.equal({
      completed: false,
      nodes: [
        {
          firewall_id: firstNode.id,
          name: firstNode.name,
          machine_name: 'fwcloud-cluster-master',
          status: 'rolled_back',
          central_machine_cleanup_required: true,
          central_bouncer_cleanup_required: true,
          error: 'Bouncer replication failed',
        },
      ],
    });
  });

  it('should authorize cluster role transitions before contacting agents', async () => {
    managePolicyStub.resolves(Authorization.revoke());

    await expect(
      controller.transitionRole(request({ confirm: true, mode: CrowdSecInstallationMode.Machine })),
    ).to.be.rejected;
    expect(configureCentralLapiStub.called).to.be.false;
  });

  it('should reject unauthorized cluster Machine installation before contacting agents', async () => {
    managePolicyStub.resolves(Authorization.revoke());

    await expect(controller.installMachine(request())).to.be.rejected;
    expect(configureCentralLapiStub.called).to.be.false;
  });
});

function lapiInstallation(firewallId: number): CrowdSecInstallation {
  return Object.assign(new CrowdSecInstallation(), {
    firewallId,
    mode: CrowdSecInstallationMode.Lapi,
    localRemediation: true,
  });
}

function machineInstallation(
  firewallId: number,
  machineName: string,
  localRemediation: boolean,
): CrowdSecInstallation {
  return Object.assign(new CrowdSecInstallation(), {
    firewallId,
    mode: CrowdSecInstallationMode.Machine,
    centralFirewallId: 10,
    lapiUrl: 'http://192.0.2.10:8080',
    machineName,
    localRemediation,
    machineConnectivityPending: false,
  });
}

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

function request(body: Record<string, unknown> = {}): Request {
  return {
    body: {
      centralFirewallId: 10,
      lapiUrl: 'http://192.0.2.10:8080',
      localRemediation: false,
      ...body,
    },
    session: { user: null },
  } as unknown as Request;
}
