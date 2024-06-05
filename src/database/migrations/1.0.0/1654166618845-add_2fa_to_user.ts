import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
  Unique,
} from 'typeorm';

export class add2faToUser1654166618845 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createTable(
      new Table({
        name: 'tfa',
        columns: [
          {
            name: 'id',
            type: 'int',
            isGenerated: true,
            generationStrategy: 'increment',
            isPrimary: true,
          },
          {
            name: 'secret',
            type: 'varchar',
          },
          {
            name: 'tempSecret',
            type: 'varchar',
          },
          {
            name: 'dataURL',
            type: 'text',
          },
          {
            name: 'tfaURL',
            type: 'varchar',
          },
          {
            name: 'user',
            type: 'int',
            length: '11',
            isUnique: true,
          },
        ],
        foreignKeys: [
          {
            columnNames: ['user'],
            referencedTableName: 'user',
            referencedColumnNames: ['id'],
          },
        ],
      }),
      true,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('tfa');
  }
}
