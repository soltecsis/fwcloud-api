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

import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCrowdSecBlockingStatistics1792482500000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `crowdsec_blocking_statistics_sampling` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`firewall` int NOT NULL, ' +
        '`enabled` tinyint NOT NULL DEFAULT 0, ' +
        '`sampling_interval` int unsigned NOT NULL DEFAULT 30, ' +
        '`request_max_samples` int unsigned NOT NULL DEFAULT 1000, ' +
        '`cache_max_size` int unsigned NOT NULL DEFAULT 10485760, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        '`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`id`), ' +
        'UNIQUE KEY `UQ_crowdsec_blocking_statistics_sampling_firewall` (`firewall`), ' +
        'CONSTRAINT `FK_crowdsec_blocking_statistics_sampling_firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE CASCADE' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `crowdsec_blocking_statistics` (' +
        '`id` bigint unsigned NOT NULL AUTO_INCREMENT, ' +
        '`firewall` int NOT NULL, ' +
        '`collected_at` datetime(3) NOT NULL, ' +
        '`policy_generation` bigint unsigned NOT NULL, ' +
        '`ipv4_input_packets` bigint unsigned NOT NULL, ' +
        '`ipv4_input_bytes` bigint unsigned NOT NULL, ' +
        '`ipv4_forward_packets` bigint unsigned NOT NULL, ' +
        '`ipv4_forward_bytes` bigint unsigned NOT NULL, ' +
        '`ipv6_input_packets` bigint unsigned NOT NULL, ' +
        '`ipv6_input_bytes` bigint unsigned NOT NULL, ' +
        '`ipv6_forward_packets` bigint unsigned NOT NULL, ' +
        '`ipv6_forward_bytes` bigint unsigned NOT NULL, ' +
        'PRIMARY KEY (`id`), ' +
        'KEY `IDX_crowdsec_blocking_statistics_firewall_collected` (`firewall`, `collected_at`), ' +
        'KEY `IDX_crowdsec_blocking_statistics_firewall_generation_collected` (`firewall`, `policy_generation`, `collected_at`), ' +
        'CONSTRAINT `FK_crowdsec_blocking_statistics_firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE CASCADE' +
        ') ENGINE=InnoDB',
    );
    await queryRunner.query(
      'CREATE TABLE `crowdsec_blocking_statistics_address` (' +
        '`id` bigint unsigned NOT NULL AUTO_INCREMENT, ' +
        '`crowdsec_blocking_statistics` bigint unsigned NOT NULL, ' +
        '`address` varchar(255) NOT NULL, ' +
        '`packets` bigint unsigned NOT NULL, ' +
        '`bytes` bigint unsigned NOT NULL, ' +
        'PRIMARY KEY (`id`), ' +
        'KEY `IDX_crowdsec_blocking_statistics_address_lookup` (`address`, `crowdsec_blocking_statistics`), ' +
        'CONSTRAINT `FK_crowdsec_blocking_statistics_address_statistics` FOREIGN KEY (`crowdsec_blocking_statistics`) REFERENCES `crowdsec_blocking_statistics` (`id`) ON DELETE CASCADE' +
        ') ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `crowdsec_blocking_statistics_address`');
    await queryRunner.query('DROP TABLE `crowdsec_blocking_statistics`');
    await queryRunner.query('DROP TABLE `crowdsec_blocking_statistics_sampling`');
  }
}
