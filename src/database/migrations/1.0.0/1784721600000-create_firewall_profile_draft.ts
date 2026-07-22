import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateFirewallProfileDraft1784721600000 implements MigrationInterface {
  private readonly tableName = 'firewall_profile_draft';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: this.tableName,
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          { name: 'fwcloud_id', type: 'int' },
          { name: 'created_by', type: 'int', isNullable: true, default: null },
          { name: 'updated_by', type: 'int', isNullable: true, default: null },
          { name: 'status', type: 'varchar', length: '32' },
          { name: 'contract_version', type: 'varchar', length: '64' },
          { name: 'proposal', type: 'longtext' },
          { name: 'proposal_hash', type: 'char', length: '64' },
          { name: 'preview_hash', type: 'char', length: '64', isNullable: true, default: null },
          { name: 'apply_hash', type: 'char', length: '64', isNullable: true, default: null },
          { name: 'step_log', type: 'longtext', isNullable: true, default: null },
          { name: 'target_ids', type: 'longtext', isNullable: true, default: null },
          {
            name: 'idempotency_key_ref',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          {
            name: 'request_id',
            type: 'varchar',
            length: '255',
            isNullable: true,
            default: null,
          },
          { name: 'created_at', type: 'timestamp', default: 'CURRENT_TIMESTAMP' },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
          { name: 'validated_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'previewed_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'apply_pending_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'applied_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'failed_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'discarded_at', type: 'timestamp', isNullable: true, default: null },
          { name: 'expired_at', type: 'timestamp', isNullable: true, default: null },
        ],
      }),
      true,
    );

    await queryRunner.createForeignKeys(this.tableName, [
      new TableForeignKey({
        name: 'FK_firewall_profile_draft_fwcloud',
        columnNames: ['fwcloud_id'],
        referencedTableName: 'fwcloud',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
      new TableForeignKey({
        name: 'FK_firewall_profile_draft_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
      new TableForeignKey({
        name: 'FK_firewall_profile_draft_updated_by',
        columnNames: ['updated_by'],
        referencedTableName: 'user',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    ]);

    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'IDX_firewall_profile_draft_fwcloud_status',
        columnNames: ['fwcloud_id', 'status'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // TypeORM drops this table's indexes and foreign keys before the table.
    await queryRunner.dropTable(this.tableName, true, true, true);
  }
}
