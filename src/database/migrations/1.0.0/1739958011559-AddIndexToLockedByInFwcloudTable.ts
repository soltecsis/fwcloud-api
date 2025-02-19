import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIndexToLockedByInFwcloudTable1739958011559 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE fwcloud ADD INDEX idx_locked_by (locked_by);
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
          ALTER TABLE fwcloud DROP INDEX idx_locked_by;
        `);
  }
}
