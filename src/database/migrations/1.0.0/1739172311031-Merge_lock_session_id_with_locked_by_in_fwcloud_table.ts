import { MigrationInterface, QueryRunner } from 'typeorm';

export class MergeLockSessionIdWithLockedByInFwcloudTable1739172311031
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE fwcloud
            DROP COLUMN lock_session_id;`);
    await queryRunner.query(`ALTER TABLE fwcloud DROP COLUMN locked_by;`);
    await queryRunner.query(
      `ALTER TABLE fwcloud ADD COLUMN locked_by VARCHAR(255) after locked_at;`,
    );
    await queryRunner.query(`UPDATE fwcloud SET locked = '0';`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE fwcloud DROP COLUMN locked_by;');
    await queryRunner.query(`ALTER TABLE fwcloud ADD COLUMN locked_by INT after locked_at;`);
    await queryRunner.query(`ALTER TABLE fwcloud ADD COLUMN lock_session_id VARCHAR(255);`);
    await queryRunner.query(`UPDATE fwcloud SET locked = '0';`);
  }
}
