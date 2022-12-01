import {MigrationInterface, QueryRunner} from "typeorm";

export class addOpenvpnStatusHistoryIndexes1669884249679 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE openvpn_status_history ADD INDEX IDX_d5f7fe1875fc92dba78c500371 (timestamp)");
        await queryRunner.query("ALTER TABLE openvpn_status_history ADD INDEX IDX_adba662cf32738c010d418fda8 (openvpn_server_id, timestamp)");
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query("ALTER TABLE openvpn_status_history DROP INDEX IDX_d5f7fe1875fc92dba78c500371");
        await queryRunner.query("ALTER TABLE openvpn_status_history DROP INDEX IDX_adba662cf32738c010d418fda8");
    }

}
