import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class CreateSessionIDLockedByInFwcloudTable1737018267742 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'fwcloud',
      new TableColumn({
        name: 'lock_session_id',
        type: 'varchar',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('fwcloud', 'lock_session_id');
  }
}
