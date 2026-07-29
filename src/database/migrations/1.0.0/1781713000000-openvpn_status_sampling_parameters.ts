import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class openvpnStatusSamplingParameters1781713000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('openvpn', [
      new TableColumn({
        name: 'status_sampling_interval',
        type: 'int',
        isNullable: false,
        default: 30,
      }),
      new TableColumn({
        name: 'status_sampling_request_max_lines',
        type: 'int',
        isNullable: false,
        default: 1000,
      }),
      new TableColumn({
        name: 'status_sampling_cache_max_size',
        type: 'int',
        isNullable: false,
        default: 10485760,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumns('openvpn', [
      'status_sampling_cache_max_size',
      'status_sampling_request_max_lines',
      'status_sampling_interval',
    ]);
  }
}
