/*
    Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/

import { MigrationInterface, QueryRunner } from 'typeorm';

const newIPobjTypes = [
  { id: 320, type: 'WIREGUARD CONFIG', protocol_number: null },
  { id: 321, type: 'WIREGUARD CLI', protocol_number: null },
  { id: 322, type: 'WIREGUARD SRV', protocol_number: null },
  { id: 330, type: 'IPSEC CONFIG', protocol_number: null },
  { id: 331, type: 'IPSEC CLI', protocol_number: null },
  { id: 332, type: 'IPSEC SRV', protocol_number: null },
];

const newFWCTreeNodeTypes = [
  { node_type: 'VPN', obj_type: null, name: 'VPN' },
  { node_type: 'WG', obj_type: 320, name: 'WireGuard Config' },
  { node_type: 'WGC', obj_type: 321, name: 'WireGuard Config CLI' },
  { node_type: 'WGS', obj_type: 322, name: 'WireGuard Config SRV' },
  { node_type: 'IS', obj_type: 330, name: 'IPSec Config' },
  { node_type: 'ISC', obj_type: 331, name: 'IPSec Config CLI' },
  { node_type: 'ISS', obj_type: 332, name: 'IPSec Config SRV' },
];

export class MultiVPNNodes1736247039919 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add missing foreign key constraint to `fwc_tree_node_types`
    await queryRunner.query(
      'ALTER TABLE `fwc_tree_node_types` ADD KEY `FK_7e8b69d9c4f0d72d415eb6b6cd8a9` (`obj_type`), ADD CONSTRAINT `FK_7e8b69d9c4f0d72d415eb6b6cd8a9` FOREIGN KEY (`obj_type`) REFERENCES `ipobj_type` (`id`)',
    );

    // Add new IPobj types to the ipobj_type table
    for (let i = 0; i < newIPobjTypes.length; i++) {
      await queryRunner.query(
        'INSERT INTO ipobj_type (id, type, protocol_number) VALUES (?, ?, ?)',
        [newIPobjTypes[i].id, newIPobjTypes[i].type, newIPobjTypes[i].protocol_number],
      );
    }

    // Add new FWC tree node types to the fwc_tree_node_types table
    for (let i = 0; i < newFWCTreeNodeTypes.length; i++) {
      await queryRunner.query(
        'INSERT INTO fwc_tree_node_types (node_type, obj_type, name, api_call_base, order_mode) VALUES (?, ?, ?, NULL, 2)',
        [
          newFWCTreeNodeTypes[i].node_type,
          newFWCTreeNodeTypes[i].obj_type,
          newFWCTreeNodeTypes[i].name,
        ],
      );
    }

    // Select existing OpenVPN nodes to associate them with the new VPN node
    const openVPNNodes = await queryRunner.query(
      "SELECT id, id_parent, id_obj, fwcloud FROM fwc_tree WHERE node_type='OPN'",
    );

    for (const node of openVPNNodes) {
      // Create the parent VPN node for the existing OpenVPN node, inheriting the same id_parent
      const result = await queryRunner.query(
        "INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud) VALUES ('VPN', ?, 0, 'VPN', ?, NULL, ?)",
        [node.id_parent, node.id_obj, node.fwcloud],
      );

      const vpnNodeId = result.insertId; // Get the ID of the newly created VPN node

      // Associate the existing OpenVPN node as a child of the new VPN node
      await queryRunner.query('UPDATE `fwc_tree` SET `id_parent` = ? WHERE `id` = ?', [
        vpnNodeId,
        node.id,
      ]);

      // Add WireGuard and IPsec nodes as children of the new VPN node
      await queryRunner.query(
        "INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud) VALUES ('WireGuard', ?, 0, 'WG', ?, 0, ?)",
        [vpnNodeId, node.id_obj, node.fwcloud],
      );
      await queryRunner.query(
        "INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud) VALUES ('IPSec', ?, 0, 'IS', ?, 0, ?)",
        [vpnNodeId, node.id_obj, node.fwcloud],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert OpenVPN nodes to their original parent
    const openVPNNodes = await queryRunner.query(
      "SELECT id, id_parent FROM fwc_tree WHERE node_type='OPN'",
    );

    for (const node of openVPNNodes) {
      // Find the grandparent node
      const grandParentNode = await queryRunner.query(
        'SELECT id_parent FROM fwc_tree WHERE id = ?',
        [node.id_parent],
      );

      if (grandParentNode.length > 0) {
        // Revert the OpenVPN node to its grandparent
        await queryRunner.query('UPDATE `fwc_tree` SET `id_parent` = ? WHERE `id` = ?', [
          grandParentNode[0].id_parent,
          node.id,
        ]);
      }
    }

    // Remove the new VPN nodes and their children
    const vpnNodes = await queryRunner.query("SELECT id FROM fwc_tree WHERE node_type='VPN'");

    for (const node of vpnNodes) {
      // Remove the WireGuard and IPsec nodes
      await queryRunner.query('DELETE FROM fwc_tree WHERE id_parent = ?', [node.id]);

      // Remove the VPN node
      await queryRunner.query('DELETE FROM fwc_tree WHERE id = ?', [node.id]);
    }

    // Remove the foreign key constraint from `fwc_tree_node_types`
    await queryRunner.query(
      'ALTER TABLE `fwc_tree_node_types` DROP FOREIGN KEY `FK_7e8b69d9c4f0d72d415eb6b6cd8a9`, DROP KEY `FK_7e8b69d9c4f0d72d415eb6b6cd8a9`',
    );

    // Remove the new IPobj types from the ipobj_type table
    for (let i = 0; i < newIPobjTypes.length; i++) {
      await queryRunner.query('DELETE FROM ipobj_type WHERE id = ?', [newIPobjTypes[i].id]);
    }

    // Remove the new FWC tree node types from the fwc_tree_node_types table
    for (let i = 0; i < newFWCTreeNodeTypes.length; i++) {
      await queryRunner.query('DELETE FROM fwc_tree_node_types WHERE node_type = ?', [
        newFWCTreeNodeTypes[i].node_type,
      ]);
    }
  }
}
