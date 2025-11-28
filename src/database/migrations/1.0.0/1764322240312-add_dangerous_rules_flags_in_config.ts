/*
  Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

export class AddDangerousRulesFlagsInConfig1764322240312 implements MigrationInterface {
  private static readonly WARNING_FLAG = 0x0100;
  private static readonly CRITICAL_FLAG = 0x0200;
  private static readonly FLAGS_MASK =
    AddDangerousRulesFlagsInConfig1764322240312.WARNING_FLAG |
    AddDangerousRulesFlagsInConfig1764322240312.CRITICAL_FLAG;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE firewall SET options = options | ${AddDangerousRulesFlagsInConfig1764322240312.FLAGS_MASK};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE firewall SET options = options & ~${AddDangerousRulesFlagsInConfig1764322240312.FLAGS_MASK};`,
    );
  }
}
