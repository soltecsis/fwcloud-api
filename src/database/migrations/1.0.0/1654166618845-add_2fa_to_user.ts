import {MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex, Unique} from "typeorm";

export class add2faToUser1654166618845 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.createTable(
            new Table({
                name:"user_tfa",
                columns:[
                    {
                        name: "id",
                        type: "int",
                        isGenerated: true,
                        generationStrategy: 'increment',
                        isPrimary: true
                    },
                    {
                        name: "secret",
                        type: "varchar"
                    },
                    {
                        name: "tempSecret",
                        type: "varchar"
                    },
                    {
                        name: "dataURL",
                        type: "text"
                    },
                    {
                        name: "tfaURL",
                        type: "varchar"
                    }
                ],
            }),
            true
        )

        await queryRunner.addColumn(
            "user",
            new TableColumn({
                name: 'tfa',
                type: 'int',
                isNullable: true,
                default: null
            })
        )

        await queryRunner.createForeignKey(
            "user",
            new TableForeignKey({
                columnNames: ['tfa'],
                referencedColumnNames: ["id"],
                referencedTableName: "user_tfa",
                onDelete: "CASCADE"
            })
        )

        /*await queryRunner.createIndex("user",new TableIndex({
            columnNames: ['tfa'],
            isUnique: true
        }))*/
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable("user")
        const foreignKey = table.foreignKeys.find(
            (fk) => fk.columnNames.indexOf("tfa") !== null,
        )
        await queryRunner.dropForeignKey("user",foreignKey)
        await queryRunner.dropColumn("user","tfa")
        await queryRunner.dropTable("user_tfa")
    }

}
