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
            "SELECT `id` FROM `fwc_tree` WHERE `node_type` IN ('FW', 'CL')"
        );

        for (const node of nodes) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`,`node_order`) VALUES (?, 'System', 'SYS',1)",
                [node.id]
            );
        }

        const systems = await queryRunner.query(
            "SELECT `id` FROM `fwc_tree` WHERE `name` = 'System'"
        );

        for (const system of systems) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`,`node_order`) VALUES (?, 'DHCP', 'S01',2)",
                [system.id]
            );

            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`,`node_order`) VALUES (?, 'Keepalived', 'S02',2)",
                [system.id]
            );

            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`,`node_order`) VALUES (?, 'HAProxy', 'S03',2)",
                [system.id]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DELETE t1 FROM `fwc_tree` t1 JOIN `fwc_tree` t2 ON t1.`parent_id` = t2.`id` WHERE t2.`name` = 'System' AND t1.`name` IN ('DHCP', 'Keepalived', 'HAProxy')"
        );

        await queryRunner.query(
            "DELETE t1 FROM `fwc_tree` t1 JOIN `fwc_tree` t2 ON t1.`parent_id` = t2.`id` WHERE t2.`node_type` = 'FW' AND t1.`name` = 'System'"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` IN ('SYS', 'S01', 'S02', 'S03') AND `name` IN ('System', 'DHCP', 'Keepalived', 'HAProxy')"
        );
    }
}
