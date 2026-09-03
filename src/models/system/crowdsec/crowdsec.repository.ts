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

import { EntityManager } from 'typeorm';
import { Repository } from '../../../database/repository';
import { CrowdSecInstallation, CrowdSecInstallationMode } from './crowdsec-installation.model';
import {
  Firewall,
  FirewallInstallCommunication,
  FirewallInstallProtocol,
} from '../../firewall/Firewall';

export type CrowdSecMachineInstallation = {
  firewallId: number;
  centralFirewallId: number;
  lapiUrl: string;
  machineName: string;
  localRemediation: boolean;
};

export class CrowdSecInstallationRepository extends Repository<CrowdSecInstallation> {
  constructor(manager?: EntityManager) {
    super(CrowdSecInstallation, manager);
  }

  public async saveStandaloneInstallation(firewallId: number): Promise<CrowdSecInstallation> {
    return this.saveInstallation({
      firewallId,
      mode: CrowdSecInstallationMode.Standalone,
      centralFirewallId: null,
      lapiUrl: null,
      machineName: null,
      localRemediation: false,
    });
  }

  public async saveMachineInstallation(
    installation: CrowdSecMachineInstallation,
  ): Promise<CrowdSecInstallation> {
    return this.saveInstallation({
      ...installation,
      mode: CrowdSecInstallationMode.Machine,
    });
  }

  public async findByFirewallId(firewallId: number): Promise<CrowdSecInstallation | null> {
    return this.findOne({
      where: { firewallId },
      relations: ['firewall', 'centralFirewall'],
    });
  }

  public async findCentralCandidates(
    fwcloudId: number,
    remoteFirewallId: number,
  ): Promise<CrowdSecInstallation[]> {
    return this.createQueryBuilder('installation')
      .innerJoinAndSelect('installation.firewall', 'firewall')
      .where('installation.mode = :mode', { mode: CrowdSecInstallationMode.Standalone })
      .andWhere('firewall.fwcloud = :fwcloudId', { fwcloudId })
      .andWhere('firewall.id != :remoteFirewallId', { remoteFirewallId })
      .andWhere('firewall.install_communication = :communication', {
        communication: FirewallInstallCommunication.Agent,
      })
      .andWhere('firewall.install_protocol = :protocol', {
        protocol: FirewallInstallProtocol.HTTPS,
      })
      .orderBy('firewall.name', 'ASC')
      .getMany();
  }

  public async hasMachineDependents(centralFirewallId: number): Promise<boolean> {
    return (
      (await this.count({
        where: {
          centralFirewallId,
          mode: CrowdSecInstallationMode.Machine,
        },
      })) > 0
    );
  }

  public async removeByFirewallId(firewallId: number): Promise<void> {
    await this.delete({ firewallId });
  }

  public async removeMachineInstallation(
    centralFirewallId: number,
    machineName: string,
  ): Promise<void> {
    await this.delete({
      centralFirewallId,
      machineName,
      mode: CrowdSecInstallationMode.Machine,
    });
  }

  private async saveInstallation(
    installation: Partial<CrowdSecInstallation> & { firewallId: number },
  ): Promise<CrowdSecInstallation> {
    const current = await this.findOne({ where: { firewallId: installation.firewallId } });

    return this.save({
      ...current,
      ...installation,
    });
  }
}
