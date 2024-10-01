import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ChangePluginsTypeSmallintToInt1716792622695 implements MigrationInterface {
  private async changeColumnType(
    queryRunner: QueryRunner,
    tableName: string,
    oldType: string,
    newType: string,
  ): Promise<void> {
    const tempColumnName = 'plugins_temp';

    // Create a temporary column to store the data
    await queryRunner.addColumn(
      tableName,
      new TableColumn({
        name: tempColumnName,
        type: newType,
        isNullable: true,
      }),
    );

    // Copy the data from the original column to the temporary column.
    await queryRunner.query(`UPDATE ${tableName} SET ${tempColumnName} = plugins;`);

    // Delete the original column
    await queryRunner.dropColumn(tableName, 'plugins');

    // Rename the temporary column to plugins
    await queryRunner.renameColumn(tableName, tempColumnName, 'plugins');

    // Ensure that the column is not null
    await queryRunner.changeColumn(
      tableName,
      'plugins',
      new TableColumn({
        name: 'plugins',
        type: newType,
        isNullable: false,
        default: 0,
      }),
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.changeColumnType(queryRunner, 'firewall', 'smallint', 'int');
    await this.changeColumnType(queryRunner, 'cluster', 'smallint', 'int');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.changeColumnType(queryRunner, 'firewall', 'int', 'smallint');
    await this.changeColumnType(queryRunner, 'cluster', 'int', 'smallint');
  }
}
