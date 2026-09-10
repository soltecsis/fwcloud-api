import { MigrationInterface, QueryRunner } from 'typeorm';

export class ClearFail2banRunBefore1787127009780 implements MigrationInterface {
  private static readonly FAIL2BAN_SPECIAL_RULE = 5;
  private static readonly LEGACY_RUN_BEFORE =
    'if [ "$BOOT_STATE" != "initializing" ] && [ "$BOOT_STATE" != "starting" ]; then\n' +
    '  systemctl restart fail2ban\n' +
    'fi';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE policy_r SET run_before = '' WHERE special = ${ClearFail2banRunBefore1787127009780.FAIL2BAN_SPECIAL_RULE}`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE policy_r SET run_before = ? WHERE special = ${ClearFail2banRunBefore1787127009780.FAIL2BAN_SPECIAL_RULE}`,
      [ClearFail2banRunBefore1787127009780.LEGACY_RUN_BEFORE],
    );
  }
}
