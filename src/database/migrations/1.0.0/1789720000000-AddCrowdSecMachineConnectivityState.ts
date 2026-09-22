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

import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddCrowdSecMachineConnectivityState1789720000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'crowdsec_installation',
      new TableColumn({
        name: 'machine_connectivity_pending',
        type: 'tinyint',
        length: '1',
        isNullable: false,
        default: 0,
      }),
    );

    await queryRunner.addColumn(
      'crowdsec_installation',
      new TableColumn({
        name: 'console_enrollment_confirmed',
        type: 'tinyint',
        length: '1',
        isNullable: false,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('crowdsec_installation', 'console_enrollment_confirmed');
    await queryRunner.dropColumn('crowdsec_installation', 'machine_connectivity_pending');
  }
}
