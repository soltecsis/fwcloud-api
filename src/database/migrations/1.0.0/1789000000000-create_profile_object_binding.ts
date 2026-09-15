import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateProfileObjectBinding1789000000000 implements MigrationInterface {
  private readonly tableName = 'profile_object_binding';

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
          { name: 'fwcloud', type: 'int', isNullable: false },
          { name: 'profile_code', type: 'varchar', length: '128', isNullable: false },
          { name: 'profile_version', type: 'int', isNullable: false },
          { name: 'target_firewall', type: 'int', isNullable: false },
          { name: 'binding_kind', type: 'varchar', length: '32', isNullable: false },
          { name: 'binding_key', type: 'varchar', length: '128', isNullable: false },
          { name: 'object_id', type: 'int', isNullable: false },
          { name: 'created_by_profile', type: 'tinyint', isNullable: false, default: 0 },
          {
            name: 'created_at',
            type: 'datetime',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'IDX_profile_object_binding_target',
        columnNames: ['profile_code', 'profile_version', 'target_firewall'],
      }),
    );

    // One binding per (profile version, target, kind, key): re-applying updates
    // the row instead of accumulating duplicates.
    await queryRunner.createIndex(
      this.tableName,
      new TableIndex({
        name: 'UQ_profile_object_binding',
        columnNames: [
          'fwcloud',
          'profile_code',
          'profile_version',
          'target_firewall',
          'binding_kind',
          'binding_key',
        ],
        isUnique: true,
      }),
    );

    await queryRunner.createForeignKey(
      this.tableName,
      new TableForeignKey({
        name: 'FK_profile_object_binding_fwcloud',
        columnNames: ['fwcloud'],
        referencedTableName: 'fwcloud',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      this.tableName,
      new TableForeignKey({
        name: 'FK_profile_object_binding_firewall',
        columnNames: ['target_firewall'],
        referencedTableName: 'firewall',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable(this.tableName, true);
  }
}
