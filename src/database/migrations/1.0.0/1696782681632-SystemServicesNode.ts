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

        const nodes = await queryRunner.query(
            "SELECT `id`,`fwcloud` FROM `fwc_tree` WHERE `node_type` IN ('FW', 'CL')"
        );

        for (const node of nodes) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'System', 'SYS',1,?,?)",
                [node.id,node.id,node.fwcloud]
            );
        }

        const systems = await queryRunner.query(
            "SELECT `id`,`fwcloud`  FROM `fwc_tree` WHERE `node_type` = 'SYS'"
        );

        for (const system of systems) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'DHCP', 'S01',2,?,?)",
                [system.id,system.id,system.fwcloud]
            );

            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'Keepalived', 'S02',2,?,?)",
                [system.id,system.id,system.fwcloud]
            );

            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`,`node_order`,`id_obj`,`fwcloud` ) VALUES (?, 'HAProxy', 'S03',2,?,?)",
                [system.id,system.id,system.fwcloud]
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
