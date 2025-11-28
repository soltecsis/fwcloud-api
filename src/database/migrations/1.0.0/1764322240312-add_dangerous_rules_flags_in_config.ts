import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDangerousRulesFlagsInConfig1764322240312 implements MigrationInterface {
  private static readonly WARNING_FLAG = 0x0100;
  private static readonly CRITICAL_FLAG = 0x0200;
  private static readonly FLAGS_MASK =
    AddDangerousRulesFlagsInConfig1764322240312.WARNING_FLAG |
    AddDangerousRulesFlagsInConfig1764322240312.CRITICAL_FLAG;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE firewall SET options = options | ${AddDangerousRulesFlagsInConfig1764322240312.FLAGS_MASK};`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE firewall SET options = options & ~${AddDangerousRulesFlagsInConfig1764322240312.FLAGS_MASK};`,
    );
  }
}
