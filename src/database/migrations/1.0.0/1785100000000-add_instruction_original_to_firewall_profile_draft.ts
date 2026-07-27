import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddInstructionOriginalToFirewallProfileDraft1785100000000 implements MigrationInterface {
  private readonly tableName = 'firewall_profile_draft';
  private readonly columnName = 'instruction_original';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      this.tableName,
      new TableColumn({
        name: this.columnName,
        type: 'text',
        isNullable: true,
        default: null,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn(this.tableName, this.columnName);
  }
}
