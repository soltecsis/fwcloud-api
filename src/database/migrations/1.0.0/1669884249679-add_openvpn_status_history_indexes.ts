import { MigrationInterface, QueryRunner } from 'typeorm';

export class addOpenvpnStatusHistoryIndexes1669884249679 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const result: Array<{ 'Create Table': string }> = await queryRunner.query(
      'show create table openvpn_status_history',
    );
    const idx1 = 'IDX_d5f7fe1875fc92dba78c500371';
    const idx2 = 'IDX_adba662cf32738c010d418fda8';

    // If index doesn't already exists, then create it.
    if (result.length === 1 && result[0]['Create Table'].search(idx1) === -1) {
      await queryRunner.query(`ALTER TABLE openvpn_status_history ADD INDEX ${idx1} (timestamp)`);
    }

    // If index doesn't already exists, then create it.
    if (result.length === 1 && result[0]['Create Table'].search(idx2) === -1) {
      await queryRunner.query(
        `ALTER TABLE openvpn_status_history ADD INDEX ${idx2} (openvpn_server_id, timestamp)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /* 
            This rollback actions generates errors like this with the tests:
            QueryFailedError: Cannot drop index 'IDX_adba662cf32738c010d418fda8': needed in a foreign key constraint
        */
    //await queryRunner.query(`ALTER TABLE openvpn_status_history DROP INDEX ${idx1}`);
    //await queryRunner.query(`ALTER TABLE openvpn_status_history DROP INDEX ${idx2}`);
  }
}
