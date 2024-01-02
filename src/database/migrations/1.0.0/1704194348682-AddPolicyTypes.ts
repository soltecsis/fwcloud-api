import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPolicyTypes1704194348682 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE policy_type MODIFY type VARCHAR(5)`);

        await queryRunner.query(`
            INSERT INTO policy_type (id, type, name, type_order, show_action) 
            VALUES 
                (105, 'S01', 'DHCP', 6, false),
                (106, 'S02', 'Keepalived', 7, false),
                (107, 'S03', 'HAProxy', 8, false),
                (108, 'S01_1', 'DHCP Fixed', 9, false)
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            DELETE FROM policy_type WHERE id IN (100, 101, 102)
        `);

        await queryRunner.query(`ALTER TABLE policy_type MODIFY type VARCHAR(2)`);
    }

}
