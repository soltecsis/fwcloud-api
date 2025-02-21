import { MigrationInterface, QueryRunner } from 'typeorm';

export class FwcloudCloudLock1740127476775 implements MigrationInterface {
  private static readonly idxLockedBy = 'IDX_f7a3d9e8b6c2f5d4e1a0c3b8d7';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE fwcloud SET locked_by = NULL, locked_at = NULL, locked = 0;`);
    await queryRunner.query(`ALTER TABLE fwcloud MODIFY COLUMN locked_by VARCHAR(255)`);

    const result = await queryRunner.query('SHOW CREATE TABLE fwcloud');

    // If index doesn't already exist, then create it.
    if (
      result.length === 1 &&
      result[0]['Create Table'].search(FwcloudCloudLock1740127476775.idxLockedBy) === -1
    ) {
      await queryRunner.query(
        `ALTER TABLE fwcloud ADD INDEX ${FwcloudCloudLock1740127476775.idxLockedBy} (locked_by)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`UPDATE fwcloud SET locked_by = NULL, locked_at = NULL, locked = 0;`);
    await queryRunner.query('ALTER TABLE fwcloud MODIFY COLUMN locked_by INT;');

    const result = await queryRunner.query('SHOW CREATE TABLE fwcloud');

    // If index exists, then drop it.
    if (
      result.length === 1 &&
      result[0]['Create Table'].search(FwcloudCloudLock1740127476775.idxLockedBy) !== -1
    ) {
      await queryRunner.query(
        `ALTER TABLE fwcloud DROP INDEX ${FwcloudCloudLock1740127476775.idxLockedBy}`,
      );
    }
  }
}
