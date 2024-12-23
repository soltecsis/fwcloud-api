import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiVPNNodes1734949018264 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the parent node MultiVPN
    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES ('VPN', NULL, 'VPN')",
    );

    // Add WireGuard and IPsec to `fwc_tree_node_types`
    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES ('WGR', NULL, 'WireGuard')",
    );

    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES ('IPS', NULL, 'IPsec')",
    );

    // Select existing OpenVPN nodes to associate them with MultiVPN
    const openVPNNodes = await queryRunner.query(
      "SELECT `id`, `id_obj`, `fwcloud` FROM `fwc_tree` WHERE `node_type` = 'OPN'",
    );

    for (const node of openVPNNodes) {
      // Create the parent MultiVPN node associated with each OpenVPN
      const result = await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'VPN', 'VPN', 0, NULL, ?)",
        [node.id, node.fwcloud],
      );

      const multiVPNId = result.insertId; // Get the ID of the newly created MultiVPN node

      // Associate OpenVPN as a child of MultiVPN
      await queryRunner.query('UPDATE `fwc_tree` SET `id_parent` = ? WHERE `id` = ?', [
        multiVPNId,
        node.id,
      ]);

      // Add WireGuard and IPsec nodes as children of MultiVPN
      await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'WireGuard', 'WGR', 1, NULL, ?)",
        [multiVPNId, node.fwcloud],
      );

      await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'IPsec', 'IPS', 2, NULL, ?)",
        [multiVPNId, node.fwcloud],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Delete WireGuard and IPsec nodes
    await queryRunner.query("DELETE FROM `fwc_tree` WHERE `node_type` IN ('WGR', 'IPS')");

    // Restore OpenVPN nodes to their original state
    const multiVPNNodes = await queryRunner.query(
      "SELECT `id`, `id_parent` FROM `fwc_tree` WHERE `node_type` = 'VPN'",
    );

    for (const node of multiVPNNodes) {
      await queryRunner.query(
        "UPDATE `fwc_tree` SET `id_parent` = ? WHERE `id_parent` = ? AND `node_type` = 'OPN'",
        [node.id_parent, node.id],
      );
    }

    // Delete MultiVPN nodes
    await queryRunner.query("DELETE FROM `fwc_tree` WHERE `node_type` = 'VPN'");

    // Delete the MultiVPN, WireGuard, and IPsec node types from `fwc_tree_node_types`.
    await queryRunner.query(
      "DELETE FROM `fwc_tree_node_types` WHERE `node_type` IN ('VPN', 'WGR', 'IPS')",
    );
  }
}
