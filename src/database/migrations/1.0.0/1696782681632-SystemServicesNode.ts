import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class SystemServicesNode1696782681632 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'SYS', NULL, 'System')"
        );

        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'SYS', NULL, 'DHCP')"
        );

        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'SYS', NULL, 'Keepalived')"
        );

        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'SYS', NULL, 'HAProxy')"
        );

        const firewalls = await queryRunner.query(
            "SELECT `id` FROM `fwc_tree` WHERE `node_type` = 'firewall'"
        );

        for (const firewall of firewalls) {
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`) VALUES (?, 'System', 'SYS')",
                [firewall.id]
            );
        }

        const systems = await queryRunner.query(
            "SELECT `id` FROM `fwc_tree` WHERE `name` = 'System'"
        );

        for (const system of systems) {
            // Inserta nodo DHCP
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`) VALUES (?, 'DHCP', 'SYS_CHILD')",
                [system.id]
            );

            // Inserta nodo Keepalived
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`) VALUES (?, 'Keepalived', 'SYS_CHILD')",
                [system.id]
            );

            // Inserta nodo HAProxy
            await queryRunner.query(
                "INSERT INTO `fwc_tree` (`parent_id`, `name`, `node_type`) VALUES (?, 'HAProxy', 'SYS_CHILD')",
                [system.id]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Elimina los nodos hijos de 'System'
        await queryRunner.query(
            "DELETE t1 FROM `fwc_tree` t1 JOIN `fwc_tree` t2 ON t1.`parent_id` = t2.`id` WHERE t2.`name` = 'System' AND t1.`name` IN ('DHCP', 'Keepalived', 'HAProxy')"
        );

        // Elimina los nodos 'System' que son hijos de nodos con tipo 'firewall'
        await queryRunner.query(
            "DELETE t1 FROM `fwc_tree` t1 JOIN `fwc_tree` t2 ON t1.`parent_id` = t2.`id` WHERE t2.`node_type` = 'firewall' AND t1.`name` = 'System'"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'SYS' AND `name` = 'System'"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'SYS' AND `name` = 'DHCP'"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'SYS' AND `name` = 'Keepalived'"
        );

        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'SYS' AND `name` = 'HAProxy'"
        );
    }
}
