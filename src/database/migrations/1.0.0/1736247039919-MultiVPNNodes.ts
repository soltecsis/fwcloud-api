import { MigrationInterface, QueryRunner } from 'typeorm';

export class MultiVPNNodes1736247039919 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create the parent node MultiVPN
    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES ('VPN', 300, 'VPN')",
    );

    // Add WireGuard and IPsec to `fwc_tree_node_types`
    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES ('WGR', 320, 'WireGuard')",
    );

    await queryRunner.query(
      "INSERT INTO `fwc_tree_node_types` (`node_type`, `obj_type`, `name`) VALUES ('IPS', 330, 'IPsec')",
    );

    // Select existing OpenVPN nodes to associate them with MultiVPN
    const openVPNNodes = await queryRunner.query(
      "SELECT `id`, `id_parent`, `id_obj`, `fwcloud` FROM `fwc_tree` WHERE `node_type` = 'OPN'",
    );

    for (const node of openVPNNodes) {
      // Create the parent VPN node for the existing OpenVPN node, inheriting the same id_parent
      const result = await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'VPN', 'VPN', 0, NULL, ?)",
        [node.id_parent, node.fwcloud],
      );

      const vpnNodeId = result.insertId; // Get the ID of the newly created VPN node

      // Associate the existing OpenVPN node as a child of the new VPN node
      await queryRunner.query('UPDATE `fwc_tree` SET `id_parent` = ? WHERE `id` = ?', [
        vpnNodeId,
        node.id,
      ]);

      // Add WireGuard and IPsec nodes as children of the new VPN node
      await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'WireGuard', 'WGR', 1, NULL, ?)",
        [vpnNodeId, node.fwcloud],
      );

      await queryRunner.query(
        "INSERT INTO `fwc_tree` (`id_parent`, `name`, `node_type`, `node_order`, `id_obj`, `fwcloud`) VALUES (?, 'IPsec', 'IPS', 2, NULL, ?)",
        [vpnNodeId, node.fwcloud],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Retrieve all VPN nodes
    const vpnNodes = await queryRunner.query(
      "SELECT `id`, `id_parent` FROM `fwc_tree` WHERE `node_type` = 'VPN'",
    );

    for (const vpnNode of vpnNodes) {
      // Delete all child nodes associated with the VPN node recursively
      const childNodes = await queryRunner.query(
        'SELECT `id` FROM `fwc_tree` WHERE `id_parent` = ?',
        [vpnNode.id],
      );

      for (const child of childNodes) {
        await queryRunner.query('DELETE FROM `fwc_tree` WHERE `id` = ?', [child.id]);
      }

      // Restore the OpenVPN nodes to their original state
      await queryRunner.query(
        "UPDATE `fwc_tree` SET `id_parent` = ? WHERE `id_parent` = ? AND `node_type` = 'OPN'",
        [vpnNode.id_parent, vpnNode.id],
      );

      // Delete the VPN node
      await queryRunner.query('DELETE FROM `fwc_tree` WHERE `id` = ?', [vpnNode.id]);
    }

    // Delete the MultiVPN, WireGuard, and IPsec node types from `fwc_tree_node_types`
    await queryRunner.query(
      "DELETE FROM `fwc_tree_node_types` WHERE `node_type` IN ('VPN', 'WGR', 'IPS')",
    );
  }
}
