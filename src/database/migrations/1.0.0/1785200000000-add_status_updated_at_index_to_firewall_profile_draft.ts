import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddStatusUpdatedAtIndexToFirewallProfileDraft1785200000000 implements MigrationInterface {
  private readonly tableName = 'firewall_profile_draft';
  private readonly indexName = 'IDX_firewall_profile_draft_status_updated_at';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: this.indexName,
        columnNames: ['status', 'updated_at'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(this.tableName, this.indexName);
  }
}
