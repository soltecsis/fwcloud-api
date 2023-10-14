import {MigrationInterface, QueryRunner, Table} from "typeorm";

export class SystemServicesNode1696782681632 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES( 'SYS', NULL, 'System')"
        );

        await queryRunner.createTable(new Table({
            name: 'system',
            columns: [
                {
                    name: 'id',
                    type: 'int',
                    isGenerated: true,
                    generationStrategy: 'increment',
                    isPrimary: true
                },
                {
                    name: 'firewall_cluster_id',
                    type: 'int',
                    isNullable: false
                },
                {
                    name: 'node_type',
                    type: 'varchar',
                    isNullable: false
                }
            ],
            indices: [{ columnNames: ['firewall'], isUnique: true }],
            foreignKeys: [
                {
                    columnNames: ['firewall'],
                    referencedTableName: 'firewall',
                    referencedColumnNames: ['id']
                }
            ]
        }));

        // Retrieve all existing firewalls and clusters
        const firewallsAndClusters = await queryRunner.query("SELECT id FROM firewall UNION SELECT id FROM cluster");

        for (const item of firewallsAndClusters) {
            // Insert an entry in the system table for each firewall and cluster
            await queryRunner.query(
                "INSERT INTO system (firewall_cluster_id, node_type) VALUES (?, 'System')",
                [item.id]
            );

            // Retrieve the id of the newly created system entry
            const [systemEntry] = await queryRunner.query(
                "SELECT id FROM system WHERE firewall_cluster_id = ? AND node_type = 'System'",
                [item.id]
            );

            // Create child nodes: DHCP, Keepalived, and HAProxy for the system entry."
            await queryRunner.query(
                "INSERT INTO system (firewall_cluster_id, node_type) VALUES (?, 'DHCP'), (?, 'Keepalived'), (?, 'HAProxy')",
                [systemEntry.id, systemEntry.id, systemEntry.id]
            );
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            "DELETE FROM `fwc_tree_node_types` WHERE `node_type` = 'SYS' AND `name` = 'System'"
        );

        await queryRunner.dropTable('system');
    }
}
