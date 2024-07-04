import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ChangePluginsTypeSmallintToInt1716792622695 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'firewall',
      'plugins',
      new TableColumn({
        name: 'plugins',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
    );

    await queryRunner.changeColumn(
      'cluster',
      'plugins',
      new TableColumn({
        name: 'plugins',
        type: 'int',
        isNullable: false,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.changeColumn(
      'firewall',
      'plugins',
      new TableColumn({
        name: 'plugins',
        type: 'smallint',
        length: '2',
        isNullable: false,
        default: 0,
      }),
    );

    await queryRunner.changeColumn(
      'cluster',
      'plugins',
      new TableColumn({
        name: 'plugins',
        type: 'smallint',
        length: '2',
        isNullable: false,
        default: 0,
      }),
    );
  }
}
