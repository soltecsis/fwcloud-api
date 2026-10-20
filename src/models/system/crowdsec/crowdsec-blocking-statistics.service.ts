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

import { CrowdSecFirewallBouncerStatisticsSample } from '../../../communications/communication';
import db from '../../../database/database-manager';
import { Service } from '../../../fonaments/services/service';
import { CrowdSecBlockingStatisticsAddress } from './crowdsec-blocking-statistics-address.model';
import { CrowdSecBlockingStatistics } from './crowdsec-blocking-statistics.model';

export class CrowdSecBlockingStatisticsService extends Service {
  async create(
    firewallId: number,
    samples: CrowdSecFirewallBouncerStatisticsSample[],
  ): Promise<number> {
    if (samples.length === 0) {
      return 0;
    }

    return db.getSource().transaction(async (manager) => {
      const statisticsRepository = manager.getRepository(CrowdSecBlockingStatistics);
      const addressRepository = manager.getRepository(CrowdSecBlockingStatisticsAddress);

      for (const sample of samples) {
        const statistics = await statisticsRepository.save(
          statisticsRepository.create({
            firewallId,
            collectedAt: this.collectedAt(sample.collectedAt),
            policyGeneration: this.counter(sample.policyGeneration),
            ipv4InputPackets: this.counter(sample.ipv4Input.packets),
            ipv4InputBytes: this.counter(sample.ipv4Input.bytes),
            ipv4ForwardPackets: this.counter(sample.ipv4Forward.packets),
            ipv4ForwardBytes: this.counter(sample.ipv4Forward.bytes),
            ipv6InputPackets: this.counter(sample.ipv6Input.packets),
            ipv6InputBytes: this.counter(sample.ipv6Input.bytes),
            ipv6ForwardPackets: this.counter(sample.ipv6Forward.packets),
            ipv6ForwardBytes: this.counter(sample.ipv6Forward.bytes),
          }),
        );

        if (sample.addresses.length > 0) {
          await addressRepository.save(
            sample.addresses.map((address) =>
              addressRepository.create({
                statisticsId: statistics.id,
                address: address.address,
                packets: this.counter(address.packets),
                bytes: this.counter(address.bytes),
              }),
            ),
          );
        }
      }

      return samples.length;
    });
  }

  private collectedAt(value: string): Date {
    const collectedAt = new Date(value);
    if (Number.isNaN(collectedAt.getTime())) {
      throw new Error('CrowdSec Firewall Bouncer statistics sample has an invalid collection date');
    }
    return collectedAt;
  }

  private counter(value: number): string {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error('CrowdSec Firewall Bouncer statistics sample has an invalid counter');
    }
    return value.toString();
  }
}
