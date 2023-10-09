import {MigrationInterface, QueryRunner} from "typeorm";

export class SystemServicesNode1696782681632 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        const tables = [
            { tableName: 'firewall', objType: 1 },
            { tableName: 'cluster', objType: 2 }
        ];

        for (let table of tables) {
            const items = await queryRunner.query(`SELECT id FROM ${table.tableName}`);

            for (let item of items) {
                await queryRunner.query(`INSERT INTO fwc_tree (name, id_parent, node_type, id_obj, obj_type) VALUES (?, NULL, 'SYS', ?, ?)`, ['System', item.id, table.objType]);
            }
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (let table of tables) {
            await queryRunner.query(`DELETE FROM fwc_tree WHERE node_type='SYS' AND obj_type=?`, [table.objType]);
        }
    }
}
