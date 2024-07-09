import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from 'typeorm';

export class createApplyToColumnsInRouting1651849467696 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('routing_r', [
      new TableColumn({
        name: 'fw_apply_to',
        type: 'int',
        length: '11',
        isNullable: true,
        default: null,
      }),
    ]);
    await queryRunner.createForeignKey(
      'routing_r',
      new TableForeignKey({
        columnNames: ['fw_apply_to'],
        referencedTableName: 'firewall',
        referencedColumnNames: ['id'],
      }),
    );

    await queryRunner.addColumns('route', [
      new TableColumn({
        name: 'fw_apply_to',
        type: 'int',
        length: '11',
        isNullable: true,
        default: null,
      }),
    ]);
    await queryRunner.createForeignKey(
      'route',
      new TableForeignKey({
        columnNames: ['fw_apply_to'],
        referencedTableName: 'firewall',
        referencedColumnNames: ['id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table_routing_r = await queryRunner.getTable('routing_r');
    const foreignKey_table_routing_r = table_routing_r.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('fw_apply_to') !== -1,
    );
    await queryRunner.dropForeignKey('routing_r', foreignKey_table_routing_r);

    await queryRunner.dropColumn('routing_r', 'fw_apply_to');

    const table_route = await queryRunner.getTable('route');
    const foreignKey_table_route = table_route.foreignKeys.find(
      (fk) => fk.columnNames.indexOf('fw_apply_to') !== -1,
    );
    await queryRunner.dropForeignKey('route', foreignKey_table_route);

    await queryRunner.dropColumn('route', 'fw_apply_to');
  }
}
