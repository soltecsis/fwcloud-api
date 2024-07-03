import { MigrationInterface, QueryRunner } from 'typeorm';

export class alterFwcTreeTable1598767224314 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `ALTER TABLE fwc_tree MODIFY COLUMN name VARCHAR(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {}
}
