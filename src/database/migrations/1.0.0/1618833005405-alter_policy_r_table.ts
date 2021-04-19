import {MigrationInterface, QueryRunner} from "typeorm";

export class alterPolicyRTable1618833005405 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE policy_r ADD COLUMN run_before TEXT AFTER special`);
        await queryRunner.query(`ALTER TABLE policy_r ADD COLUMN run_after TEXT AFTER run_before`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE policy_r DROP COLUMN run_before`);
        await queryRunner.query(`ALTER TABLE policy_r DROP COLUMN run_after`);
    }

}
