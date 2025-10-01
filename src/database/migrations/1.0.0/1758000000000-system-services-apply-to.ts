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

import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

type ServiceTable = {
  name: string;
  fkName: string;
};

const services: ServiceTable[] = [
  { name: 'haproxy_r', fkName: 'FK_haproxy_r_fw_apply_to_firewall_id' },
  { name: 'keepalived_r', fkName: 'FK_keepalived_r_fw_apply_to_firewall_id' },
];

export class SystemServicesApplyTo1758000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const service of services) {
      const hasColumn = await queryRunner.hasColumn(service.name, 'fw_apply_to');

      if (!hasColumn) {
        await queryRunner.addColumn(
          service.name,
          new TableColumn({
            name: 'fw_apply_to',
            type: 'int',
            length: '11',
            isNullable: true,
            default: null,
          }),
        );

        await queryRunner.createForeignKey(
          service.name,
          new TableForeignKey({
            name: service.fkName,
            columnNames: ['fw_apply_to'],
            referencedTableName: 'firewall',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const service of services) {
      const table = await queryRunner.getTable(service.name);
      const foreignKey = table?.foreignKeys.find((fk) => fk.name === service.fkName);

      if (foreignKey) {
        await queryRunner.dropForeignKey(service.name, foreignKey);
      }

      const hasColumn = await queryRunner.hasColumn(service.name, 'fw_apply_to');
      if (hasColumn) {
        await queryRunner.dropColumn(service.name, 'fw_apply_to');
      }
    }
  }
}
