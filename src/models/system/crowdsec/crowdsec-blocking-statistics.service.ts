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
import { Repository } from 'typeorm';
import db from '../../../database/database-manager';
import { Service } from '../../../fonaments/services/service';
import { CrowdSecBlockingStatisticsAddress } from './crowdsec-blocking-statistics-address.model';
import { CrowdSecBlockingStatistics } from './crowdsec-blocking-statistics.model';

export type CrowdSecBlockingStatisticsHistoryRange = {
  startsAt?: Date;
  endsAt?: Date;
};

export type CrowdSecBlockingStatisticsCounter = {
  packets: number;
  bytes: number;
};

export type CrowdSecBlockingStatisticsHistorySample = {
  collectedAt: Date;
  policyGeneration: string;
  ipv4Input: CrowdSecBlockingStatisticsCounter;
  ipv4Forward: CrowdSecBlockingStatisticsCounter;
  ipv6Input: CrowdSecBlockingStatisticsCounter;
  ipv6Forward: CrowdSecBlockingStatisticsCounter;
};

export type CrowdSecBlockingStatisticsAddressHistorySample = {
  address: string;
  collectedAt: Date;
  policyGeneration: string;
  packets: number;
  bytes: number;
};

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

  async history(
    firewallId: number,
    range: CrowdSecBlockingStatisticsHistoryRange = {},
  ): Promise<CrowdSecBlockingStatisticsHistorySample[]> {
    const repository = db.getSource().manager.getRepository(CrowdSecBlockingStatistics);
    const previous = await this.previousStatistics(repository, firewallId, range.startsAt);
    const query = repository
      .createQueryBuilder('statistics')
      .where('statistics.firewall = :firewallId', { firewallId })
      .orderBy('statistics.collected_at', 'ASC')
      .addOrderBy('statistics.id', 'ASC');
    this.applyRange(query, 'statistics.collected_at', range);

    let previousSample = previous;
    return (await query.getMany()).map((statistics) => {
      const sample: CrowdSecBlockingStatisticsHistorySample = {
        collectedAt: statistics.collectedAt,
        policyGeneration: statistics.policyGeneration,
        ipv4Input: this.delta(
          statistics.ipv4InputPackets,
          statistics.ipv4InputBytes,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv4InputPackets
            : null,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv4InputBytes
            : null,
        ),
        ipv4Forward: this.delta(
          statistics.ipv4ForwardPackets,
          statistics.ipv4ForwardBytes,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv4ForwardPackets
            : null,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv4ForwardBytes
            : null,
        ),
        ipv6Input: this.delta(
          statistics.ipv6InputPackets,
          statistics.ipv6InputBytes,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv6InputPackets
            : null,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv6InputBytes
            : null,
        ),
        ipv6Forward: this.delta(
          statistics.ipv6ForwardPackets,
          statistics.ipv6ForwardBytes,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv6ForwardPackets
            : null,
          previousSample?.policyGeneration === statistics.policyGeneration
            ? previousSample.ipv6ForwardBytes
            : null,
        ),
      };
      previousSample = statistics;
      return sample;
    });
  }

  async addressHistory(
    firewallId: number,
    addresses: string[],
    range: CrowdSecBlockingStatisticsHistoryRange = {},
  ): Promise<CrowdSecBlockingStatisticsAddressHistorySample[]> {
    if (addresses.length === 0) {
      return [];
    }

    const repository = db.getSource().manager.getRepository(CrowdSecBlockingStatisticsAddress);
    const previous = await this.previousAddresses(
      repository,
      firewallId,
      addresses,
      range.startsAt,
    );
    const query = repository
      .createQueryBuilder('address')
      .innerJoinAndSelect('address.statistics', 'statistics')
      .where('statistics.firewall = :firewallId', { firewallId })
      .andWhere('address.address IN (:...addresses)', { addresses })
      .orderBy('address.address', 'ASC')
      .addOrderBy('statistics.collected_at', 'ASC')
      .addOrderBy('statistics.id', 'ASC');
    this.applyRange(query, 'statistics.collected_at', range);

    return (await query.getMany()).map((address) => {
      const key = `${address.address}\u0000${address.statistics.policyGeneration}`;
      const currentPrevious = previous.get(key);
      const sample: CrowdSecBlockingStatisticsAddressHistorySample = {
        address: address.address,
        collectedAt: address.statistics.collectedAt,
        policyGeneration: address.statistics.policyGeneration,
        ...this.delta(
          address.packets,
          address.bytes,
          currentPrevious?.packets ?? null,
          currentPrevious?.bytes ?? null,
        ),
      };
      previous.set(key, address);
      return sample;
    });
  }

  private applyRange(
    query: { andWhere: (query: string, parameters: Record<string, Date>) => unknown },
    column: string,
    range: CrowdSecBlockingStatisticsHistoryRange,
  ): void {
    if (range.startsAt) {
      query.andWhere(`${column} >= :startsAt`, { startsAt: range.startsAt });
    }
    if (range.endsAt) {
      query.andWhere(`${column} <= :endsAt`, { endsAt: range.endsAt });
    }
  }

  private delta(
    packets: string,
    bytes: string,
    previousPackets: string | null,
    previousBytes: string | null,
  ): CrowdSecBlockingStatisticsCounter {
    const currentPackets = BigInt(packets);
    const currentBytes = BigInt(bytes);
    const previousPacketCounter = previousPackets === null ? null : BigInt(previousPackets);
    const previousByteCounter = previousBytes === null ? null : BigInt(previousBytes);

    return {
      packets: Number(
        previousPacketCounter !== null && currentPackets >= previousPacketCounter
          ? currentPackets - previousPacketCounter
          : 0n,
      ),
      bytes: Number(
        previousByteCounter !== null && currentBytes >= previousByteCounter
          ? currentBytes - previousByteCounter
          : 0n,
      ),
    };
  }

  private async previousStatistics(
    repository: Repository<CrowdSecBlockingStatistics>,
    firewallId: number,
    startsAt?: Date,
  ): Promise<CrowdSecBlockingStatistics | null> {
    if (!startsAt) {
      return null;
    }
    return repository
      .createQueryBuilder('statistics')
      .where('statistics.firewall = :firewallId', { firewallId })
      .andWhere('statistics.collected_at < :startsAt', { startsAt })
      .orderBy('statistics.collected_at', 'DESC')
      .addOrderBy('statistics.id', 'DESC')
      .getOne();
  }

  private async previousAddresses(
    repository: Repository<CrowdSecBlockingStatisticsAddress>,
    firewallId: number,
    addresses: string[],
    startsAt?: Date,
  ): Promise<Map<string, CrowdSecBlockingStatisticsAddress>> {
    const previous = new Map<string, CrowdSecBlockingStatisticsAddress>();
    if (!startsAt) {
      return previous;
    }

    const results = await repository
      .createQueryBuilder('address')
      .innerJoinAndSelect('address.statistics', 'statistics')
      .where('statistics.firewall = :firewallId', { firewallId })
      .andWhere('address.address IN (:...addresses)', { addresses })
      .andWhere('statistics.collected_at < :startsAt', { startsAt })
      .andWhere(
        `NOT EXISTS (
          SELECT 1
          FROM crowdsec_blocking_statistics_address previous_address
          INNER JOIN crowdsec_blocking_statistics previous_statistics
            ON previous_statistics.id = previous_address.crowdsec_blocking_statistics
          WHERE previous_address.address = address.address
            AND previous_statistics.firewall = :firewallId
            AND previous_statistics.policy_generation = statistics.policy_generation
            AND previous_statistics.collected_at < :startsAt
            AND (
              previous_statistics.collected_at > statistics.collected_at
              OR (
                previous_statistics.collected_at = statistics.collected_at
                AND previous_statistics.id > statistics.id
              )
            )
        )`,
      )
      .getMany();
    for (const address of results) {
      previous.set(`${address.address}\u0000${address.statistics.policyGeneration}`, address);
    }
    return previous;
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
