import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import defaultReplicationProfile from '../../../models/replication-profile/presets/default-replication-profile.v1.json';

export class CreateReplicationProfiles1779870504111 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'replication_profiles',
        columns: [
          {
            name: 'id',
            type: 'int',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'code',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'version',
            type: 'int',
            isNullable: false,
            default: 1,
          },
          {
            name: 'name',
            type: 'varchar',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
            default: null,
          },
          {
            name: 'scope',
            type: 'varchar',
            isNullable: false,
            default: "'generic'",
          },
          {
            name: 'target_kind',
            type: 'varchar',
            isNullable: false,
            default: "'firewall'",
          },
          {
            name: 'model',
            type: 'longtext',
            isNullable: false,
          },
          {
            name: 'is_built_in',
            type: 'boolean',
            isNullable: false,
            default: 1,
          },
          {
            name: 'is_active',
            type: 'boolean',
            isNullable: false,
            default: 1,
          },
          {
            name: 'is_deprecated',
            type: 'boolean',
            isNullable: false,
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            isNullable: false,
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
        uniques: [
          {
            columnNames: ['code', 'version'],
          },
        ],
      }),
      true,
      true,
    );

    await queryRunner.query(
      `
    INSERT INTO replication_profiles
      (
        code,
        version,
        name,
        description,
        scope,
        target_kind,
        model,
        is_built_in,
        is_active,
        is_deprecated
      )
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
      [
        defaultReplicationProfile.code,
        defaultReplicationProfile.version,
        defaultReplicationProfile.name,
        defaultReplicationProfile.description,
        defaultReplicationProfile.scope,
        defaultReplicationProfile.target_kind,
        JSON.stringify(defaultReplicationProfile.model),
        1,
        1,
        0,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('replication_profiles');
  }
}
