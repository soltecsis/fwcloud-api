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

export class CreateCrowdSecInstallation1788424879 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'CREATE TABLE `crowdsec_installation` (' +
        '`id` int NOT NULL AUTO_INCREMENT, ' +
        '`firewall` int NOT NULL, ' +
        '`mode` varchar(16) NOT NULL, ' +
        '`central_firewall` int NULL, ' +
        '`lapi_url` varchar(256) NULL, ' +
        '`machine_name` varchar(128) NULL, ' +
        '`local_remediation` tinyint NOT NULL DEFAULT 0, ' +
        '`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP, ' +
        '`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, ' +
        'PRIMARY KEY (`id`), ' +
        'UNIQUE KEY `UQ_crowdsec_installation_firewall` (`firewall`), ' +
        'KEY `IDX_crowdsec_installation_central_firewall` (`central_firewall`), ' +
        'CONSTRAINT `FK_crowdsec_installation_firewall` FOREIGN KEY (`firewall`) REFERENCES `firewall` (`id`) ON DELETE CASCADE, ' +
        'CONSTRAINT `FK_crowdsec_installation_central_firewall` FOREIGN KEY (`central_firewall`) REFERENCES `firewall` (`id`) ON DELETE RESTRICT' +
        ') ENGINE=InnoDB',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE `crowdsec_installation`');
  }
}
