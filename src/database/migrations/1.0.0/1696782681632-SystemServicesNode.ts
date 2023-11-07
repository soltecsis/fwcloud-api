import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class SystemServicesNode1696782681632 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'SYS', NULL, 'System')"
        );

        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'S01', NULL, 'DHCP')"
        );

        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'S02', NULL, 'Keepalived')"
        );

        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'S03', NULL, 'HAProxy')"
        );

        let nodes = await queryRunner.query(
            "SELECT `id`, `fwcloud`\n" +
            "FROM `fwc_tree` t\n" +
            "WHERE `node_type` IN ('FW', 'CL')\n" +
            "AND ( \n" +
            "  `node_type` != 'FW' OR \n" +
            "  `id_parent` IS NULL OR \n" +
            "  `id_parent` NOT IN (SELECT `id` FROM `fwc_tree` WHERE `node_type` = 'FCF')\n" +
            ")\n" +
            "AND NOT EXISTS (" +
            "SELECT 1 FROM `fwc_tree` c WHERE c.`id_parent` = t.`id` AND c.`node_type` = 'SYS'" +
            ");"
        );

        for (const node of nodes) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'System', 'SYS',0,?,?)",
                [node.id,node.id_obj,node.fwcloud]
            );
        }

        nodes = await queryRunner.query(
            "SELECT `id`, `fwcloud`\n" +
            "FROM `fwc_tree` t\n" +
            "WHERE `node_type` = 'SYS'\n" +
            "AND NOT EXISTS (\n" +
            "    SELECT 1\n" +
            "    FROM `fwc_tree` c\n" +
            "    WHERE c.`id_parent` = t.`id`\n" +
            "    AND c.`node_type` IN ('S01', 'S02', 'S03')\n" +
            ");"
        );

        for (const node of nodes) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'DHCP', 'S01',0,?,?)",
                [node.id,node.id_obj,node.fwcloud]
            );

            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'Keepalived', 'S02',0,?,?)",
                [node.id,node.id_obj,node.fwcloud]
            );

            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'HAProxy', 'S03',0,?,?)",
                [node.id,node.id_obj,node.fwcloud]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DELETE FROM `fwc_tree` WHERE `node_type` IN ('S01', 'S02', 'S03')"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree` WHERE `node_type` = 'SYS'"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` IN ('SYS', 'S01', 'S02', 'S03')"
        );
    }
}
