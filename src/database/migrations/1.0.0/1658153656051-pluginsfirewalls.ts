import { MigrationInterface, QueryRunner, TableColumn } from "typeorm";

export class pluginsfirewalls1658153656051 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      "firewall",
      new TableColumn({
        name: "plugins",
        type: "smallint",
        length: "2",
        isNullable: false,
        default: 0,
      }),
    );

    await queryRunner.addColumn(
      "cluster",
      new TableColumn({
        name: "plugins",
        type: "smallint",
        length: "2",
        isNullable: false,
        default: 0,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn("firewall", "plugins");
    await queryRunner.dropColumn("cluster", "plugins");
  }
}
