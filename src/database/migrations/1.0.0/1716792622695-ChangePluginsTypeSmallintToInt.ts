import { MigrationInterface, QueryRunner } from 'typeorm';

export class ChangePluginsTypeSmallintToInt1716792622695 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE firewall
      MODIFY COLUMN plugins INT NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE cluster
      MODIFY COLUMN plugins INT NOT NULL DEFAULT 0;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE firewall
      MODIFY COLUMN plugins SMALLINT NOT NULL DEFAULT 0;
    `);

    await queryRunner.query(`
      ALTER TABLE cluster
      MODIFY COLUMN plugins SMALLINT NOT NULL DEFAULT 0;
    `);
  }
}
