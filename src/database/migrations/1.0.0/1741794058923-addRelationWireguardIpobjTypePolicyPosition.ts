import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRelationWireguardIpobjTypePolicyPosition1741794058923
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    const policyPositionIds = await queryRunner.query(
      `SELECT id FROM policy_position WHERE name='Source' OR name='Destination'`,
    );
    for (let index = 0; index < policyPositionIds.length; index++) {
      await queryRunner.query(`INSERT IGNORE INTO ipobj_type__policy_position VALUES(?,?)`, [
        321,
        policyPositionIds[index].id,
      ]);
      await queryRunner.query(`INSERT IGNORE INTO ipobj_type__policy_position VALUES(?,?)`, [
        402,
        policyPositionIds[index].id,
      ]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const policyPositionIds = await queryRunner.query(
      `SELECT id FROM policy_position WHERE name='Source' OR name='Destination'`,
    );
    for (let index = 0; index < policyPositionIds.length; index++) {
      await queryRunner.query(
        `DELETE FROM ipobj_type__policy_position WHERE type=? AND position=?`,
        [321, policyPositionIds[index].id],
      );
      await queryRunner.query(
        `DELETE FROM ipobj_type__policy_position WHERE type=? AND position=?`,
        [402, policyPositionIds[index].id],
      );
    }
  }
}
