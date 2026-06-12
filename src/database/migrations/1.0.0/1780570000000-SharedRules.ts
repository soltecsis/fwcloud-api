import { MigrationInterface, QueryRunner } from 'typeorm';

export class SharedRules1780570000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT IGNORE INTO fwc_tree_node_types (node_type, obj_type, name, api_call_base, order_mode)
       VALUES ('SRF', NULL, 'Shared Rules Folder', NULL, 1),
              ('SRP4', NULL, 'Shared Rules IPv4 Policy', NULL, 1),
              ('SRP6', NULL, 'Shared Rules IPv6 Policy', NULL, 1),
              ('SRI', NULL, 'Shared Rules IPv4 Input', NULL, 1),
              ('SRO', NULL, 'Shared Rules IPv4 Output', NULL, 1),
              ('SRFW', NULL, 'Shared Rules IPv4 Forward', NULL, 1),
              ('SRSN', NULL, 'Shared Rules IPv4 SNAT', NULL, 1),
              ('SRDN', NULL, 'Shared Rules IPv4 DNAT', NULL, 1),
              ('SRI6', NULL, 'Shared Rules IPv6 Input', NULL, 1),
              ('SRO6', NULL, 'Shared Rules IPv6 Output', NULL, 1),
              ('SRFW6', NULL, 'Shared Rules IPv6 Forward', NULL, 1),
              ('SRSN6', NULL, 'Shared Rules IPv6 SNAT', NULL, 1),
              ('SRDN6', NULL, 'Shared Rules IPv6 DNAT', NULL, 1),
              ('SRS', NULL, 'Shared Rule Set', NULL, 1)`,
    );

    await queryRunner.query(
      `CREATE TABLE shared_rule_set (
        id INT(11) NOT NULL AUTO_INCREMENT,
        fwcloud INT(11) NOT NULL,
        name VARCHAR(255) NOT NULL,
        policy_type TINYINT(1) NOT NULL,
        comment LONGTEXT NULL,
        style VARCHAR(50) NULL DEFAULT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NOT NULL DEFAULT 0,
        updated_by INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY UK_shared_rule_set_fwcloud_type_name (fwcloud, policy_type, name),
        KEY IDX_shared_rule_set_fwcloud (fwcloud),
        KEY IDX_shared_rule_set_policy_type (policy_type),
        CONSTRAINT FK_shared_rule_set_fwcloud FOREIGN KEY (fwcloud) REFERENCES fwcloud(id) ON DELETE CASCADE,
        CONSTRAINT FK_shared_rule_set_policy_type FOREIGN KEY (policy_type) REFERENCES policy_type(id)
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE shared_rule (
        id INT(11) NOT NULL AUTO_INCREMENT,
        shared_rule_set INT(11) NOT NULL,
        rule_order INT(11) NOT NULL,
        direction INT(11) NULL DEFAULT NULL,
        action INT(11) NOT NULL,
        time_start DATETIME NULL DEFAULT NULL,
        time_end DATETIME NULL DEFAULT NULL,
        comment LONGTEXT NULL,
        options SMALLINT(2) NOT NULL DEFAULT 0,
        active TINYINT(1) NOT NULL DEFAULT 1,
        type TINYINT(1) NOT NULL,
        style VARCHAR(50) NULL DEFAULT NULL,
        fw_apply_to INT(11) NULL DEFAULT NULL,
        negate VARCHAR(255) NULL DEFAULT NULL,
        mark INT(11) NULL DEFAULT NULL,
        special INT(11) NOT NULL DEFAULT 0,
        run_before TEXT NULL,
        run_after TEXT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NOT NULL DEFAULT 0,
        updated_by INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        KEY IDX_shared_rule_set (shared_rule_set),
        KEY IDX_shared_rule_type (type),
        KEY IDX_shared_rule_mark (mark),
        KEY IDX_shared_rule_fw_apply_to (fw_apply_to),
        CONSTRAINT FK_shared_rule_set FOREIGN KEY (shared_rule_set) REFERENCES shared_rule_set(id) ON DELETE CASCADE,
        CONSTRAINT FK_shared_rule_type FOREIGN KEY (type) REFERENCES policy_type(id),
        CONSTRAINT FK_shared_rule_mark FOREIGN KEY (mark) REFERENCES mark(id) ON DELETE SET NULL,
        CONSTRAINT FK_shared_rule_fw_apply_to FOREIGN KEY (fw_apply_to) REFERENCES firewall(id) ON DELETE SET NULL
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE shared_rule__interface (
        rule INT(11) NOT NULL,
        interface INT(11) NOT NULL,
        position INT(11) NOT NULL,
        position_order INT(11) NULL DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NOT NULL DEFAULT 0,
        updated_by INT NOT NULL DEFAULT 0,
        PRIMARY KEY (rule, interface, position),
        KEY IDX_shared_rule_interface_interface (interface),
        KEY IDX_shared_rule_interface_position (position),
        CONSTRAINT FK_shared_rule_interface_rule FOREIGN KEY (rule) REFERENCES shared_rule(id) ON DELETE CASCADE,
        CONSTRAINT FK_shared_rule_interface_interface FOREIGN KEY (interface) REFERENCES interface(id),
        CONSTRAINT FK_shared_rule_interface_position FOREIGN KEY (position) REFERENCES policy_position(id)
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE shared_rule__ipobj (
        id_pi INT(11) NOT NULL AUTO_INCREMENT,
        rule INT(11) NOT NULL,
        ipobj INT(11) NULL DEFAULT 0,
        ipobj_g INT(11) NULL DEFAULT 0,
        interface INT(11) NULL DEFAULT 0,
        position INT(11) NOT NULL,
        position_order INT(11) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NOT NULL DEFAULT 0,
        updated_by INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id_pi),
        UNIQUE KEY UK_shared_rule_ipobj_position (rule, ipobj, ipobj_g, interface, position),
        KEY IDX_shared_rule_ipobj_position (position),
        CONSTRAINT FK_shared_rule_ipobj_rule FOREIGN KEY (rule) REFERENCES shared_rule(id) ON DELETE CASCADE,
        CONSTRAINT FK_shared_rule_ipobj_position FOREIGN KEY (position) REFERENCES policy_position(id)
      )`,
    );

    await queryRunner.query(
      `CREATE TABLE policy_r__shared_rule_set (
        id INT(11) NOT NULL AUTO_INCREMENT,
        firewall INT(11) NOT NULL,
        type TINYINT(1) NOT NULL,
        shared_rule_set INT(11) NOT NULL,
        rule_order INT(11) NOT NULL,
        active TINYINT(1) NOT NULL DEFAULT 1,
        style VARCHAR(50) NULL DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_by INT NOT NULL DEFAULT 0,
        updated_by INT NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY UK_policy_shared_rule_set (firewall, type, shared_rule_set),
        KEY IDX_policy_shared_rule_set_type (type),
        KEY IDX_policy_shared_rule_set_shared_rule_set (shared_rule_set),
        CONSTRAINT FK_policy_shared_rule_set_firewall FOREIGN KEY (firewall) REFERENCES firewall(id) ON DELETE CASCADE,
        CONSTRAINT FK_policy_shared_rule_set_type FOREIGN KEY (type) REFERENCES policy_type(id),
        CONSTRAINT FK_policy_shared_rule_set_set FOREIGN KEY (shared_rule_set) REFERENCES shared_rule_set(id) ON DELETE CASCADE
      )`,
    );

    await queryRunner.query(
      `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
       SELECT 'Shared Rules', root.id, 0, 'SRF', NULL, NULL, root.fwcloud
       FROM fwc_tree root
       WHERE root.node_type='FDO'
         AND root.id_parent IS NULL
         AND NOT EXISTS (
           SELECT 1
           FROM fwc_tree child
           WHERE child.id_parent=root.id
             AND child.node_type='SRF'
         )`,
    );

    await queryRunner.query(
      `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
       SELECT 'IPv4 POLICY', sharedRules.id, 1, 'SRP4', NULL, NULL, sharedRules.fwcloud
       FROM fwc_tree sharedRules
       WHERE sharedRules.node_type='SRF'
         AND NOT EXISTS (
           SELECT 1
           FROM fwc_tree child
           WHERE child.id_parent=sharedRules.id
             AND child.node_type='SRP4'
         )`,
    );

    await queryRunner.query(
      `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
       SELECT 'IPv6 POLICY', sharedRules.id, 2, 'SRP6', NULL, NULL, sharedRules.fwcloud
       FROM fwc_tree sharedRules
       WHERE sharedRules.node_type='SRF'
         AND NOT EXISTS (
           SELECT 1
           FROM fwc_tree child
           WHERE child.id_parent=sharedRules.id
             AND child.node_type='SRP6'
         )`,
    );

    await queryRunner.query(
      `INSERT INTO fwc_tree (name, id_parent, node_order, node_type, id_obj, obj_type, fwcloud)
       SELECT policyTypes.name, policyTree.id, policyTypes.node_order, policyTypes.node_type, policyTypes.policy_type, NULL, policyTree.fwcloud
       FROM fwc_tree policyTree
       INNER JOIN (
         SELECT 'INPUT' AS name, 1 AS node_order, 'SRI' AS node_type, 1 AS policy_type, 'SRP4' AS parent_type
         UNION ALL SELECT 'OUTPUT', 2, 'SRO', 2, 'SRP4'
         UNION ALL SELECT 'FORWARD', 3, 'SRFW', 3, 'SRP4'
         UNION ALL SELECT 'SNAT', 4, 'SRSN', 4, 'SRP4'
         UNION ALL SELECT 'DNAT', 5, 'SRDN', 5, 'SRP4'
         UNION ALL SELECT 'INPUT', 1, 'SRI6', 61, 'SRP6'
         UNION ALL SELECT 'OUTPUT', 2, 'SRO6', 62, 'SRP6'
         UNION ALL SELECT 'FORWARD', 3, 'SRFW6', 63, 'SRP6'
         UNION ALL SELECT 'SNAT', 4, 'SRSN6', 64, 'SRP6'
         UNION ALL SELECT 'DNAT', 5, 'SRDN6', 65, 'SRP6'
       ) policyTypes ON policyTypes.parent_type=policyTree.node_type
       INNER JOIN fwc_tree sharedRules ON sharedRules.id=policyTree.id_parent
       WHERE sharedRules.node_type='SRF'
         AND policyTree.node_type IN ('SRP4', 'SRP6')
         AND NOT EXISTS (
           SELECT 1
           FROM fwc_tree child
           WHERE child.id_parent=policyTree.id
             AND child.node_type=policyTypes.node_type
             AND child.id_obj=policyTypes.policy_type
         )`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM fwc_tree WHERE node_type='SRS'`);
    await queryRunner.query(
      `DELETE FROM fwc_tree
       WHERE id_parent IN (
         SELECT id FROM (
           SELECT policyTree.id
           FROM fwc_tree policyTree
           INNER JOIN fwc_tree sharedRules ON sharedRules.id=policyTree.id_parent
           WHERE sharedRules.node_type='SRF'
             AND policyTree.node_type IN ('SRP4', 'SRP6')
         ) sharedPolicyTrees
       )`,
    );
    await queryRunner.query(
      `DELETE FROM fwc_tree
       WHERE id_parent IN (
         SELECT id FROM (
           SELECT id
           FROM fwc_tree
           WHERE node_type='SRF'
         ) sharedRules
       )
       AND node_type IN ('SRP4', 'SRP6')`,
    );
    await queryRunner.query(`DELETE FROM fwc_tree WHERE node_type='SRF'`);
    await queryRunner.query(`DROP TABLE IF EXISTS shared_rule__ipobj`);
    await queryRunner.query(`DROP TABLE IF EXISTS shared_rule__interface`);
    await queryRunner.query(`DROP TABLE IF EXISTS policy_r__shared_rule_set`);
    await queryRunner.query(`DROP TABLE IF EXISTS shared_rule`);
    await queryRunner.query(`DROP TABLE IF EXISTS shared_rule_set`);
    await queryRunner.query(
      `DELETE FROM fwc_tree_node_types
       WHERE node_type IN ('SRF', 'SRP4', 'SRP6', 'SRI', 'SRO', 'SRFW', 'SRSN', 'SRDN', 'SRI6', 'SRO6', 'SRFW6', 'SRSN6', 'SRDN6', 'SRS')`,
    );
  }
}
