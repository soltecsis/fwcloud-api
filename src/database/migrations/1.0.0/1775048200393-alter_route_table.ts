import { MigrationInterface, QueryRunner, TableForeignKey } from 'typeorm';

export class AlterRouteTable1775048200393 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.dropRouteGatewayForeignKey(queryRunner);
    await queryRunner.query(`ALTER TABLE route MODIFY COLUMN gateway INT NULL`);
    await this.createRouteGatewayForeignKey(queryRunner);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const nullGatewayCountResult = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM route WHERE gateway IS NULL`,
    );
    const nullGatewayCount = Number(nullGatewayCountResult?.[0]?.count ?? 0);

    if (nullGatewayCount > 0) {
      throw new Error(
        `Cannot rollback migration 1775048200393: route.gateway contains NULL values`,
      );
    }

    await this.dropRouteGatewayForeignKey(queryRunner);
    await queryRunner.query(`ALTER TABLE route MODIFY COLUMN gateway INT NOT NULL`);
    await this.createRouteGatewayForeignKey(queryRunner);
  }

  protected async dropRouteGatewayForeignKey(queryRunner: QueryRunner): Promise<void> {
    const routeTable = await queryRunner.getTable('route');

    if (!routeTable) {
      return;
    }

    const gatewayForeignKey = routeTable.foreignKeys.find(
      (foreignKey) => foreignKey.columnNames.indexOf('gateway') !== -1,
    );

    if (gatewayForeignKey) {
      await queryRunner.dropForeignKey('route', gatewayForeignKey);
    }
  }

  protected async createRouteGatewayForeignKey(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.createForeignKey(
      'route',
      new TableForeignKey({
        columnNames: ['gateway'],
        referencedTableName: 'ipobj',
        referencedColumnNames: ['id'],
      }),
    );
  }
}
