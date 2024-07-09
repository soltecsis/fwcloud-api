import { query } from 'express';
import { MigrationInterface, QueryRunner, TableForeignKey, TableIndex } from 'typeorm';

export class changeUniqueKeyOpenvpn1653307616404 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('openvpn');
    const fk_firewall = table.foreignKeys.find((fk) => fk.columnNames.indexOf('firewall') !== -1);
    const fk_crt = table.foreignKeys.find((fk) => fk.columnNames.indexOf('crt') !== -1);
    await queryRunner.dropForeignKey('openvpn', fk_firewall);
    await queryRunner.dropForeignKey('openvpn', fk_crt);

    const indexUniqueKey = table.indices.findIndex(
      (item) => (item.columnNames = ['firewall', 'crt']),
    );
    await queryRunner.dropIndex('openvpn', table.indices[indexUniqueKey]);

    await queryRunner.createForeignKeys('openvpn', [
      new TableForeignKey({
        columnNames: ['firewall'],
        referencedTableName: 'firewall',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['crt'],
        referencedTableName: 'crt',
        referencedColumnNames: ['id'],
      }),
    ]);

    await queryRunner.createIndex(
      'openvpn',
      new TableIndex({
        columnNames: ['openvpn', 'crt'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('openvpn');
    const fk_openvpn = table.foreignKeys.find((fk) => fk.columnNames.indexOf('openvpn') !== -1);
    const fk_crt = table.foreignKeys.find((fk) => fk.columnNames.indexOf('crt') !== -1);
    await queryRunner.dropForeignKey('openvpn', fk_openvpn);
    await queryRunner.dropForeignKey('openvpn', fk_crt);

    const indexUniqueKey = table.indices.findIndex(
      (item) => (item.columnNames = ['openvpn', 'crt']),
    );
    await queryRunner.dropIndex('openvpn', table.indices[indexUniqueKey]);

    await queryRunner.createForeignKeys('openvpn', [
      new TableForeignKey({
        columnNames: ['openvpn'],
        referencedTableName: 'openvpn',
        referencedColumnNames: ['id'],
      }),
      new TableForeignKey({
        columnNames: ['crt'],
        referencedTableName: 'crt',
        referencedColumnNames: ['id'],
      }),
    ]);

    await queryRunner.createIndex(
      'openvpn',
      new TableIndex({
        columnNames: ['firewall', 'crt'],
        isUnique: true,
      }),
    );
  }
}
