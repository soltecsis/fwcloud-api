import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class openvpnStatusSampling1781712000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'openvpn',
      new TableColumn({
        name: 'status_sampling_enabled',
        type: 'tinyint',
        length: '1',
        isNullable: false,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('openvpn', 'status_sampling_enabled');
  }
}
