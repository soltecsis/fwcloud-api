/*
    Copyright 2023 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import db from '../../database/database-manager';
import Model from '../Model';
import { PrimaryGeneratedColumn, Column, SelectQueryBuilder, DataSource } from 'typeorm';
import Query from '../../database/Query';
import { logger } from '../../fonaments/abstract-application';
import { FwCloud } from '../fwcloud/FwCloud';
import { OpenVPNOption } from '../vpn/openvpn/openvpn-option.model';
import { IPObj } from '../ipobj/IPObj';
import { WireGuardOption } from '../vpn/wireguard/wireguard-option.model';
const fwcError = require('../../utils/error_table');
const asyncMod = require('async');
const _Tree = require('easy-tree');
const fwc_tree_node = require('./node.js');

const tableName: string = 'fwc_tree';

export type TreeNode = {
  id: number;
  pid: number;
  node_type: string;
  text: string;
  id_obj: number;
  obj_type: number;
  fwcloud: number;
  children: TreeNode[];
};

export type OpenVPNNode = TreeNode & {
  address: string;
};
export type WireGuardNode = TreeNode & {
  address: string;
};

export type TreeType = 'FIREWALLS' | 'OBJECTS' | 'SERVICES' | 'CA';

type ChildrenArrayMap = Map<number, TreeNode[]>;
type sortType = 'TEXT' | 'NODE_TYPE';

export class Tree extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  id_parent: number;

  @Column()
  node_order: number;

  @Column()
  node_type: string;

  @Column()
  id_obj: number;

  @Column()
  obj_type: number;

  @Column()
  fwcloud: number;

  public getTableName(): string {
    return tableName;
  }

  //Get fwcloud root node bye type.
  public static getRootNodeByType(req, type) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT T.*, P.order_mode FROM ${tableName} T
			inner join fwcloud C on C.id=T.fwcloud
			LEFT JOIN fwc_tree_node_types P on T.node_type=P.node_type
			WHERE T.fwcloud=${req.body.fwcloud} AND T.node_type=${req.dbCon.escape(type)} AND T.id_parent is null`;

      req.dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        if (rows.length === 0)
          return reject(fwcError.other(`Root node of type '${type}' not found`));
        if (rows.length > 1)
          return reject(fwcError.other(`Found more than one root nodes of type '${type}'`));
        resolve(rows[0]);
      });
    });
  }

  //Get fwcloud root node bye type.
  public static getNodeByNameAndType(fwcloud, name, type) {
    const dbCon: Query = db.getQuery();

    return new Promise((resolve, reject) => {
      const sql = `SELECT T.*, P.order_mode FROM ${tableName} T
                inner join fwcloud C on C.id=T.fwcloud
                LEFT JOIN fwc_tree_node_types P on T.node_type=P.node_type
                WHERE T.fwcloud=${fwcloud} AND T.name=${dbCon.escape(name).toString()} AND T.node_type=${dbCon.escape(type).toString()}`;

      dbCon.query(sql, (error, rows) => {
        if (error) return reject(error);
        if (rows.length === 0) return reject(fwcError.other(`Node not found`));
        if (rows.length > 1) return reject(fwcError.other(`Found more than one nodes`));
        resolve(rows[0]);
      });
    });
  }

  public static hasChilds(req, node_id) {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `SELECT count(*) AS n FROM ${tableName} WHERE id_parent=${node_id}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result[0].n > 0 ? true : false);
        },
      );
    });
  }

  //Get ipobjects node info.
  public static getNodeInfo(dbCon, fwcloud, node_type, id_obj?) {
    return new Promise((resolve, reject) => {
      let sql = `SELECT * FROM ${tableName}
                WHERE fwcloud${!fwcloud ? ' IS NULL' : '=' + fwcloud} 
                AND node_type=${dbCon.escape(node_type)}`;

      if (id_obj !== undefined) {
        sql = sql + ` AND id_obj${!id_obj ? ' IS NULL' : '=' + id_obj}`;
      }

      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  //Get node info under firewall
  public static getNodeUnderFirewall(dbCon, fwcloud, firewall, node_type) {
    return new Promise((resolve, reject) => {
      // Nodes in level 2.
      let sql = `SELECT T2.* FROM ${tableName} T1
                INNER JOIN ${tableName} T2 ON T2.id_parent=T1.id
                WHERE T1.fwcloud=${fwcloud} AND (T1.node_type='FW' OR T1.node_type='CL')  
                AND T2.id_obj=${firewall} AND T2.node_type=${dbCon.escape(node_type)}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        // If found a node in level 2 return it.
        if (result.length > 0) return resolve(result[0]);

        // If not look for nodes in level 3.
        sql = `SELECT T3.* FROM ${tableName} T1
                    INNER JOIN ${tableName} T2 ON T2.id_parent=T1.id
                    INNER JOIN ${tableName} T3 ON T3.id_parent=T2.id
                    WHERE T1.fwcloud=${fwcloud} AND (T1.node_type='FW' OR T1.node_type='CL')  
                    AND T2.id_obj=${firewall} AND T3.node_type=${dbCon.escape(node_type)}`;
        dbCon.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve(result.length > 0 ? result[0] : null);
        });
      });
    });
  }

  private static sortChildBy(
    dbCon: any,
    sortType: sortType,
    fwcloud: number,
    nodeType: string[],
    childrenArrayMap: ChildrenArrayMap,
    customOrder?: string[],
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      const sql = `select id from fwc_tree where fwcloud=${fwcloud} and node_type in (${nodeType.map((value) => `'${value}'`).join(', ')})`;

      dbCon.query(sql, async (error, nodes) => {
        if (error) return reject(error);

        switch (sortType) {
          case 'TEXT':
            for (let i = 0; i < nodes.length; i++) {
              childrenArrayMap.get(nodes[i].id).sort((a: TreeNode, b: TreeNode) => {
                if (a.text.toLowerCase() < b.text.toLowerCase()) return -1;
                if (a.text.toLowerCase() > b.text.toLowerCase()) return 1;
                return 0;
              });
            }
            break;

          case 'NODE_TYPE':
            for (let i = 0; i < nodes.length; i++) {
              childrenArrayMap.get(nodes[i].id).sort((a: TreeNode, b: TreeNode) => {
                return customOrder.indexOf(a.node_type) - customOrder.indexOf(b.node_type);
              });
            }
            break;
        }

        resolve();
      });
    });
  }

  private static nodesUnderNodes(
    dbCon: any,
    nodes: TreeNode[],
    orderBy: string,
  ): Promise<TreeNode[]> {
    return new Promise((resolve, reject) => {
      const sql = `select id, name as text, id_parent as pid, node_type, id_obj, obj_type, fwcloud
                from fwc_tree where id_parent in (${nodes.map((node) => node.id).join(', ')}) order by ${orderBy}`;

      dbCon.query(sql, async (error, nodes) => {
        if (error) return reject(error);
        resolve(nodes);
      });
    });
  }

  public static dumpTree(dbCon: any, treeType: TreeType, fwcloud: number): Promise<TreeNode> {
    return new Promise((resolve, reject) => {
      // Query for get the root node.
      const sql = `select id, name as text, id_parent as pid, node_type, id_obj, obj_type, fwcloud  
                from fwc_tree where fwcloud=${fwcloud} and id_parent is null and name='${treeType}'`;

      dbCon.query(sql, async (error, nodes) => {
        if (error) {
          logger().error(`Error querying root node in dumpTree: ${error.message}`);
          return reject(error);
        }
        if (nodes.length === 0) {
          logger().warn(`Root node not found for treeType: ${treeType}, fwCloud ID: ${fwcloud}`);
          return reject(new Error('Root node not found'));
        }

        try {
          const rootNode: TreeNode = nodes[0];
          rootNode.children = [];

          // Map each fwc_tree node id with its TreeNode children array.
          const childrenArrayMap: ChildrenArrayMap = new Map<number, TreeNode[]>();
          childrenArrayMap.set(rootNode.id, rootNode.children);

          let orderBy: string;
          // Next levels nodes.
          for (let level = 1; nodes.length > 0; level++) {
            if (treeType === 'FIREWALLS' && level > 1) orderBy = 'id';
            else if ((treeType === 'OBJECTS' || treeType === 'SERVICES') && level === 1)
              orderBy = 'id';
            else orderBy = 'name';

            nodes = await this.nodesUnderNodes(dbCon, nodes, orderBy);

            for (let i = 0; i < nodes.length; i++) {
              // Include data for OpenVpn Nodes Server
              if (nodes[i].node_type == 'OSR' || nodes[i].node_type == 'OCL') {
                nodes[i] = await this.addSearchInfoOpenVPN(nodes[i]);
              }
              // Include data for WireGuard Nodes Server
              if (nodes[i].node_type == 'WGS' || nodes[i].node_type == 'WGC') {
                nodes[i] = await this.addSearchInfoWireGuard(nodes[i]);
              }
              // Add the current node children array to the map.
              nodes[i].children = [];
              childrenArrayMap.set(nodes[i].id, nodes[i].children);

              // Add the current node to the children array of its parent node.
              const parentChildren: TreeNode[] = childrenArrayMap.get(nodes[i].pid);
              if (parentChildren !== undefined) {
                parentChildren.push(nodes[i]);
              }
            }
          }

          if (treeType === 'FIREWALLS') {
            // Sort nodes into FD (folders) and FDI (Interfaces) nodes type by name in the text field.
            await this.sortChildBy(dbCon, 'TEXT', fwcloud, ['FD', 'FDI'], childrenArrayMap);
            // Sort nodes into FL (firewalls) and CL (clusters) nodes type by custom order.
            await this.sortChildBy(dbCon, 'NODE_TYPE', fwcloud, ['FW', 'CL'], childrenArrayMap, [
              'FP',
              'FP6',
              'FDI',
              'FCF',
              'VPN',
              'ROU',
              'SYS',
            ]);
          } else if (treeType === 'SERVICES' || treeType === 'OBJECTS') {
            // Include data for advanced search.
            await this.addSearchInfo(dbCon, childrenArrayMap, treeType);
          }

          resolve(rootNode);
        } catch (error) {
          logger().error(
            `Error in dumpTree for treeType: ${treeType}, fwCloud ID: ${fwcloud} - ${error.message}`,
          );
          reject(error);
        }
      });
    });
  }

  private static addSearchInfo(
    dbCon: any,
    childrenArrayMap: ChildrenArrayMap,
    treeType: TreeType,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let fields = '';
      let nodeTypes: string[];

      if (treeType === 'SERVICES') {
        fields = 'source_port_start, source_port_end, destination_port_start, destination_port_end';
        nodeTypes = ['SOT', 'SOU'];
      } else if (treeType === 'OBJECTS') {
        fields = 'address, range_start, range_end';
        nodeTypes = ['OIA', 'OIN', 'OIR'];
      } else return resolve();

      // Map each id_obj that matches the node_type with its tree node.
      const nodesMap: Map<number, TreeNode> = new Map<number, TreeNode>();

      let item: [number, TreeNode[]];
      let ids = '';
      for (let mapIter = childrenArrayMap.entries(); (item = mapIter.next().value); ) {
        const nodesArray = item[1];
        for (let i = 0; i < nodesArray.length; i++) {
          if (nodeTypes.indexOf(nodesArray[i].node_type) !== -1 && nodesArray[i].id_obj) {
            nodesMap.set(nodesArray[i].id_obj, nodesArray[i]);
            ids += `${nodesArray[i].id_obj},`;
          }
        }
      }
      if (ids.length === 0) return resolve();
      ids = ids.slice(0, -1);

      const sql = `select id, ${fields} from ipobj where id in (${ids})`;

      dbCon.query(sql, async (error, ipobjs) => {
        if (error) return reject(error);

        for (let i = 0; i < ipobjs.length; i++) {
          const node: TreeNode = nodesMap.get(ipobjs[i].id);
          delete ipobjs[i].id;
          Object.assign(node, ipobjs[i]);
        }

        resolve();
      });
    });
  }

  private static async addSearchInfoOpenVPN(node: OpenVPNNode): Promise<OpenVPNNode> {
    const qb: SelectQueryBuilder<IPObj> = db
      .getSource()
      .manager.getRepository(IPObj)
      .createQueryBuilder('ipobj')
      .innerJoin(OpenVPNOption, 'option', 'option.ipObj = ipobj.id')
      .where('fwcloud = :fwcloud', { fwcloud: node.fwcloud })
      .andWhere('option.openVPNId = :id', { id: node.id_obj });

    if (node.node_type !== 'OSR') {
      qb.andWhere('option.name = :name', { name: 'ifconfig-push' });
    }

    const result: IPObj = await qb.getOne();

    node.address = result.address ?? '';

    return node;
  }

  private static async addSearchInfoWireGuard(node: WireGuardNode): Promise<WireGuardNode> {
    const qb: SelectQueryBuilder<IPObj> = db
      .getSource()
      .manager.getRepository(IPObj)
      .createQueryBuilder('ipobj')
      .innerJoin(WireGuardOption, 'option', 'option.ipObj = ipobj.id')
      .where('fwcloud = :fwcloud', { fwcloud: node.fwcloud })
      .andWhere('option.wireGuardId = :id', { id: node.id_obj });

    if (node.node_type !== 'WGS') {
      qb.andWhere('option.name = :name', { name: 'Address' });
    }
    const result: IPObj = await qb.getOne();

    node.address = result.address ?? '';

    return node;
  }

  // Put STD folders first.
  public static stdFoldersFirst(root_node): Promise<void> {
    return new Promise((resolve, reject) => {
      // Put standard folders at the begining.
      for (const node1 of root_node.children) {
        for (const [index, node2] of node1.children.entries()) {
          if (node2.node_type === 'STD') {
            if (index === 0) break;
            node1.children.unshift(node2);
            node1.children.splice(index + 1, 1);
            break;
          }
        }
      }
      resolve();
    });
  }

  // Remove all tree nodes with the indicated id_obj.
  public static deleteObjFromTree(fwcloud, id_obj, obj_type): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        //let sqlExists = 'SELECT fwcloud,id FROM ' + tableModel + ' WHERE node_type not like "F%" AND fwcloud=' + fwcloud + ' AND id_obj=' + id_obj;
        const sql =
          'SELECT fwcloud,id FROM ' +
          tableName +
          ' WHERE fwcloud=' +
          fwcloud +
          ' AND id_obj=' +
          id_obj +
          ' AND obj_type=' +
          obj_type;
        connection.query(sql, async (error, rows) => {
          if (error) return reject(error);

          try {
            for (const node of rows) await this.deleteFwc_TreeFullNode(node);
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  //REMOVE FULL TREE FROM PARENT NODE
  public static deleteFwc_TreeFullNode(data): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql = `SELECT * FROM ${tableName} 
				WHERE (fwcloud=${data.fwcloud} OR fwcloud is null) AND id_parent=${data.id}`;
        connection.query(sql, async (error, rows) => {
          if (error) return reject(error);

          try {
            if (rows.length > 0)
              await Promise.all(rows.map((data) => this.deleteFwc_TreeFullNode(data)));
            await this.deleteFwc_Tree_node(data.id);
            resolve();
          } catch (err) {
            return reject(err);
          }
        });
      });
    });
  }

  //DELETE NODE
  public static deleteFwc_Tree_node(id) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        connection.query(`DELETE FROM ${tableName} WHERE id=${id}`, (error, result) => {
          if (error) return reject(error);
          resolve({ result: true, msg: 'deleted' });
        });
      });
    });
  }

  // Delete nodes under the indicated node.
  public static deleteNodesUnderMe(dbCon, fwcloud, node_id): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT fwcloud,id FROM ${tableName} 
			WHERE (fwcloud=${fwcloud} OR fwcloud is null) AND id_parent=${node_id}`;
      dbCon.query(sql, async (error, rows) => {
        if (error) return reject(error);

        try {
          if (rows.length > 0)
            await Promise.all(rows.map((data) => this.deleteFwc_TreeFullNode(data)));

          resolve();
        } catch (err) {
          return reject(err);
        }
      });
    });
  }

  //Verify node info.
  public static verifyNodeInfo(id, fwcloud, id_obj) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);
        const sql =
          'select fwcloud,id_obj FROM ' + tableName + ' WHERE id=' + connection.escape(id);
        connection.query(sql, (error, result) => {
          if (error) return reject(error);

          result.length === 1 && fwcloud === result[0].fwcloud && id_obj === result[0].id_obj
            ? resolve(true)
            : resolve(false);
        });
      });
    });
  }

  //Create new node.
  public static newNode(dbCon, fwcloud, name, id_parent, node_type, id_obj, obj_type) {
    return new Promise((resolve, reject) => {
      const sql =
        'INSERT INTO ' +
        tableName +
        ' (name,id_parent,node_type,id_obj,obj_type,fwcloud)' +
        ' VALUES (' +
        dbCon.escape(name) +
        ',' +
        id_parent +
        ',' +
        dbCon.escape(node_type) +
        ',' +
        id_obj +
        ',' +
        obj_type +
        ',' +
        fwcloud +
        ')';
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  //UPDATE ID_OBJ FOR FIREWALL CLUSTER FULL TREE FROM PARENT NODE
  public static updateIDOBJFwc_TreeFullNode(data): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT ' +
          connection.escape(data.OLDFW) +
          ' as OLDFW, ' +
          connection.escape(data.NEWFW) +
          ' as NEWFW, T.* ' +
          ' FROM ' +
          tableName +
          ' T ' +
          ' WHERE fwcloud = ' +
          connection.escape(data.fwcloud) +
          ' AND id_parent=' +
          connection.escape(data.id) +
          ' AND id_obj=' +
          connection.escape(data.OLDFW);
        logger().debug(sql);
        connection.query(sql, (error, rows) => {
          if (error) return reject(error);
          if (rows.length > 0) {
            logger().debug('-----> UPDATING NODES UNDER PARENT: ' + data.id);
            //Bucle por interfaces
            Promise.all(rows.map((data) => this.updateIDOBJFwc_TreeFullNode(data)))
              .then((resp) => {
                //logger().debug("----------- FIN PROMISES ALL NODE PADRE: ", data.id);
                this.updateIDOBJFwc_Tree_node(data.fwcloud, data.id, data.NEWFW)
                  .then((resp) => {
                    //logger().debug("UPDATED NODE: ", data.id);
                    resolve();
                  })
                  .catch((e) => reject(e));
              })
              .catch((e) => {
                reject(e);
              });
          } else {
            logger().debug('NODE FINAL: TO UPDATE NODE: ', data.id);
            resolve();
            //Node whithout children, delete node
            this.updateIDOBJFwc_Tree_node(data.fwcloud, data.id, data.NEWFW)
              .then((resp) => {
                logger().debug('UPDATED NODE: ', data.id);
                resolve();
              })
              .catch((e) => reject(e));
          }
        });
      });
    });
  }

  //UPDATE NODE
  public static updateIDOBJFwc_Tree_node(fwcloud, id, idNew) {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) reject(error);
        const sql =
          'UPDATE ' +
          tableName +
          ' SET id_obj= ' +
          connection.escape(idNew) +
          ' WHERE node_type<>"CL" AND node_type<>"FW"  AND fwcloud = ' +
          connection.escape(fwcloud) +
          ' AND id = ' +
          connection.escape(id);
        logger().debug('SQL UPDATE NODE: ', sql);
        connection.query(sql, (error, result) => {
          if (error) {
            logger().debug(sql);
            logger().debug(error);
            reject(error);
          } else {
            resolve({ result: true });
          }
        });
      });
    });
  }

  //Update routing table node.
  public static updateRoutingTableNodeName(
    fwcloud: number,
    id: number,
    name: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql = `UPDATE ${tableName} SET name=${connection.escape(name).toString()} 
                    WHERE node_type='RT' AND fwcloud=${fwcloud} AND id_obj=${id}`;

        connection.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  public static createObjectsTree(dbCon: Query, fwCloudId: number) {
    return new Promise(async (resolve, reject) => {
      try {
        const ids: any = {};
        let id: any;

        // OBJECTS
        ids.OBJECTS = await this.newNode(dbCon, fwCloudId, 'OBJECTS', null, 'FDO', null, null);

        // OBJECTS / Addresses
        ids.Addresses = await this.newNode(
          dbCon,
          fwCloudId,
          'Addresses',
          ids.OBJECTS,
          'OIA',
          null,
          5,
        );
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.Addresses, 'STD', null, null);
        await this.createStdObjectsTree(dbCon, id, 'OIA', 5);

        // OBJECTS / Addresses Ranges
        ids.AddressesRanges = await this.newNode(
          dbCon,
          fwCloudId,
          'Address Ranges',
          ids.OBJECTS,
          'OIR',
          null,
          6,
        );
        id = await this.newNode(
          dbCon,
          fwCloudId,
          'Standard',
          ids.AddressesRanges,
          'STD',
          null,
          null,
        );
        await this.createStdObjectsTree(dbCon, id, 'OIR', 6);

        // OBJECTS / Networks
        ids.Networks = await this.newNode(
          dbCon,
          fwCloudId,
          'Networks',
          ids.OBJECTS,
          'OIN',
          null,
          7,
        );
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.Networks, 'STD', null, null);
        await this.createStdObjectsTree(dbCon, id, 'OIN', 7);

        // OBJECTS / DNS
        ids.DNS = await this.newNode(dbCon, fwCloudId, 'DNS', ids.OBJECTS, 'ONS', null, 9);

        // OBJECTS / Hosts
        await this.newNode(dbCon, fwCloudId, 'Hosts', ids.OBJECTS, 'OIH', null, 8);

        // OBJECTS / Marks
        ids.Marks = await this.newNode(
          dbCon,
          fwCloudId,
          'Iptables Marks',
          ids.OBJECTS,
          'MRK',
          null,
          30,
        );

        // OBJECTS / Groups
        ids.Groups = await this.newNode(dbCon, fwCloudId, 'Groups', ids.OBJECTS, 'OIG', null, 20);
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.Groups, 'STD', null, null);
        await this.createStdGroupsTree(dbCon, id, 'OIG', 20);

        // COUNTRIES
        ids.COUNTRIES = await this.newNode(dbCon, fwCloudId, 'COUNTRIES', null, 'COF', null, null);

        // COUNTRIES / AS
        id = await this.newNode(dbCon, fwCloudId, 'AS', ids.COUNTRIES, 'CON', 6, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        // COUNTRIES / EU
        id = await this.newNode(dbCon, fwCloudId, 'EU', ids.COUNTRIES, 'CON', 7, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        // CONTRIES / AF
        id = await this.newNode(dbCon, fwCloudId, 'AF', ids.COUNTRIES, 'CON', 8, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        // COUNTRIES / OC
        id = await this.newNode(dbCon, fwCloudId, 'OC', ids.COUNTRIES, 'CON', 9, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        // COUNTRIES / NA
        id = await this.newNode(dbCon, fwCloudId, 'NA', ids.COUNTRIES, 'CON', 10, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        // COUNTRIES / AN
        id = await this.newNode(dbCon, fwCloudId, 'AN', ids.COUNTRIES, 'CON', 11, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        // COUNTRIES / SA
        id = await this.newNode(dbCon, fwCloudId, 'SA', ids.COUNTRIES, 'CON', 12, 23);
        await this.createStdObjectsTree(dbCon, id, 'COD', 24);

        resolve(ids);
      } catch (error) {
        return reject(error);
      }
    });
  }

  public static createServicesTree(dbCon: Query, fwCloudId: number) {
    return new Promise(async (resolve, reject) => {
      try {
        const ids: any = {};
        let id;

        // SERVICES
        ids.SERVICES = await this.newNode(dbCon, fwCloudId, 'SERVICES', null, 'FDS', null, null);

        // SERVICES / IP
        ids.IP = await this.newNode(dbCon, fwCloudId, 'IP', ids.SERVICES, 'SOI', null, 1);
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.IP, 'STD', null, null);
        await this.createStdObjectsTree(dbCon, id, 'SOI', 1);

        // SERVICES / ICMP
        ids.ICMP = await this.newNode(dbCon, fwCloudId, 'ICMP', ids.SERVICES, 'SOM', null, 3);
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.ICMP, 'STD', null, null);
        await this.createStdObjectsTree(dbCon, id, 'SOM', 3);

        // SERVICES / TCP
        ids.TCP = await this.newNode(dbCon, fwCloudId, 'TCP', ids.SERVICES, 'SOT', null, 2);
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.TCP, 'STD', null, null);
        await this.createStdObjectsTree(dbCon, id, 'SOT', 2);

        // SERVICES / UDP
        ids.UDP = await this.newNode(dbCon, fwCloudId, 'UDP', ids.SERVICES, 'SOU', null, 4);
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.UDP, 'STD', null, null);
        await this.createStdObjectsTree(dbCon, id, 'SOU', 4);

        // SERVICES / Groups
        ids.Groups = await this.newNode(dbCon, fwCloudId, 'Groups', ids.SERVICES, 'SOG', null, 21);
        id = await this.newNode(dbCon, fwCloudId, 'Standard', ids.Groups, 'STD', null, null);
        await this.createStdGroupsTree(dbCon, id, 'SOG', 21);

        resolve(ids);
      } catch (error) {
        return reject(error);
      }
    });
  }

  public static createAllTreeCloud(fwCloud: FwCloud): Promise<void> {
    const dbCon: Query = db.getQuery();

    return new Promise(async (resolve, reject) => {
      try {
        // FIREWALLS
        await this.newNode(dbCon, fwCloud.id, 'FIREWALLS', null, 'FDF', null, null);

        // OBJECTS
        await this.createObjectsTree(dbCon, fwCloud.id);

        // SERVICES
        await this.createServicesTree(dbCon, fwCloud.id);

        // Creating root node for CA (Certification Authorities).
        await this.newNode(dbCon, fwCloud.id, 'CA', null, 'FCA', null, null);
        resolve();
      } catch (error) {
        logger().error(
          `Error in createAllTreeCloud for fwCloud ID: ${fwCloud.id} - ${error.message}`,
        );
        reject(error);
      }
    });
  }

  // Create tree with standard objects.
  public static createStdObjectsTree(dbCon, node_id, node_type, ipobj_type): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql: string;
      ipobj_type === 24 && node_type === 'COD'
        ? (sql = `SELECT i.id, i.name FROM ipobj i JOIN ipobj__ipobjg ii ON i.id=ii.ipobj JOIN ipobj_g ig ON ii.ipobj_g=ig.id WHERE ig.id=(SELECT fwt.id_obj FROM fwc_tree fwt WHERE fwt.id=${node_id})`)
        : (sql = 'SELECT id,name FROM ipobj WHERE fwcloud is null and type=' + ipobj_type);
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        try {
          sql = `INSERT INTO ${tableName} (name,id_parent,node_type,id_obj,obj_type,fwcloud) VALUES `;
          for (const ipobj of result) {
            //await this.newNode(dbCon, null, ipobj.name, node_id, node_type, ipobj.id, ipobj_type);
            sql += `(${dbCon.escape(ipobj.name)},${node_id} ,${dbCon.escape(node_type)},${ipobj.id},${ipobj_type},NULL),`;
          }
          sql = sql.slice(0, -1);
          dbCon.query(sql, async (error, result) => {
            if (error) return reject(error);

            resolve();
          });
        } catch (error) {
          return reject(error);
        }
      });
    });
  }

  // Create nodes under group.
  public static createGroupNodes(dbCon, fwcloud, node_id, group): Promise<void> {
    return new Promise((resolve, reject) => {
      let sql = `SELECT O.id,O.name,O.type FROM ipobj__ipobjg G
			INNER JOIN ipobj O ON O.id=G.ipobj
			WHERE G.ipobj_g=${group}`;
      dbCon.query(sql, async (error, ipobjs) => {
        if (error) return reject(error);

        try {
          let node_type;
          for (const ipobj of ipobjs) {
            if (ipobj.type === 1) node_type = 'SOI';
            else if (ipobj.type === 2) node_type = 'SOT';
            else if (ipobj.type === 3) node_type = 'SOM';
            else if (ipobj.type === 4) node_type = 'SOU';
            else if (ipobj.type === 5) node_type = 'OIA';
            else if (ipobj.type === 6) node_type = 'OIR';
            else if (ipobj.type === 7) node_type = 'OIN';
            else if (ipobj.type === 8) node_type = 'OIN';
            else if (ipobj.type === 9) node_type = 'ONS';
            await this.newNode(
              dbCon,
              fwcloud,
              ipobj.name,
              node_id,
              node_type,
              ipobj.id,
              ipobj.type,
            );
          }
        } catch (error) {
          return reject(error);
        }

        sql = `SELECT VPN.id,CRT.cn FROM openvpn__ipobj_g G
				INNER JOIN openvpn VPN ON VPN.id=G.openvpn
				INNER JOIN crt CRT ON CRT.id=VPN.crt
				WHERE G.ipobj_g=${group}`;
        dbCon.query(sql, async (error, openvpns) => {
          if (error) return reject(error);

          try {
            for (const openvpn of openvpns)
              await this.newNode(dbCon, fwcloud, openvpn.cn, node_id, 'OCL', openvpn.id, 311);
          } catch (error) {
            return reject(error);
          }

          sql = `SELECT P.id,P.name FROM openvpn_prefix__ipobj_g G
					INNER JOIN openvpn_prefix P ON P.id=G.prefix
					WHERE G.ipobj_g=${group}`;
          dbCon.query(sql, async (error, prefixes) => {
            if (error) return reject(error);

            try {
              for (const prefix of prefixes)
                await this.newNode(dbCon, fwcloud, prefix.name, node_id, 'PRO', prefix.id, 401);
            } catch (error) {
              return reject(error);
            }
            resolve();
          });
        });
      });
    });
  }

  // Create tree with standard groups.
  public static createStdGroupsTree(dbCon, node_id, node_type, ipobj_type): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT id,name FROM ipobj_g WHERE fwcloud is null and type=' + ipobj_type;
      dbCon.query(sql, async (error, groups) => {
        if (error) return reject(error);

        try {
          let id;
          for (const group of groups) {
            id = await this.newNode(
              dbCon,
              null,
              group.name,
              node_id,
              node_type,
              group.id,
              ipobj_type,
            );
            await this.createGroupNodes(dbCon, null, id, group.id);
          }
          resolve();
        } catch (error) {
          return reject(error);
        }
      });
    });
  }

  //Generate the IPs nodes for each interface.
  public static interfacesIpTree(connection, fwcloud, nodeId, ifId): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get interface IPs.
      const sql =
        'SELECT O.id,O.name,O.type,O.address,T.node_type FROM ipobj O' +
        ' INNER JOIN fwc_tree_node_types T on T.obj_type=O.type' +
        ' WHERE O.interface=' +
        connection.escape(ifId);
      connection.query(sql, async (error, ips) => {
        if (error) return reject(error);
        if (ips.length === 0) resolve();

        try {
          for (const ip of ips) {
            await this.newNode(
              connection,
              fwcloud,
              `${ip.name} (${ip.address})`,
              nodeId,
              ip.node_type,
              ip.id,
              ip.type,
            );
          }
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the interfaces nodes.
  public static interfacesTree(connection, fwcloud, nodeId, ownerId, ownerType): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get firewall interfaces.
      let sql = '';
      let obj_type;

      if (ownerType === 'FW') {
        sql =
          'SELECT id,name,labelName FROM interface' +
          ' WHERE firewall=' +
          connection.escape(ownerId) +
          ' AND interface_type=10';
        obj_type = 10;
      } else if (ownerType === 'HOST') {
        sql =
          'SELECT I.id,I.name,I.labelName FROM interface I' +
          ' INNER JOIN interface__ipobj IO on IO.interface=I.id ' +
          ' WHERE IO.ipobj=' +
          connection.escape(ownerId) +
          ' AND I.interface_type=11';
        obj_type = 11;
      } else return reject(fwcError.other('Invalid owner type'));

      connection.query(sql, async (error, interfaces) => {
        if (error) return reject(error);
        if (interfaces.length === 0) return resolve();

        try {
          for (const _interface of interfaces) {
            const id = await this.newNode(
              connection,
              fwcloud,
              _interface.name + (_interface.labelName ? ' [' + _interface.labelName + ']' : ''),
              nodeId,
              ownerType === 'FW' ? 'IFF' : 'IFH',
              _interface.id,
              obj_type,
            );
            await this.interfacesIpTree(connection, fwcloud, id, _interface.id);
          }
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the OpenVPN client nodes.
  public static openvpnClientTree(connection, fwcloud, firewall, server_vpn, node): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get client OpenVPN configurations.
      const sql = `SELECT VPN.id,CRT.cn FROM openvpn VPN
			INNER JOIN crt CRT on CRT.id=VPN.crt
			WHERE VPN.firewall=${firewall} and VPN.openvpn=${server_vpn}`;
      connection.query(sql, async (error, vpns) => {
        if (error) return reject(error);
        if (vpns.length === 0) return resolve();

        try {
          for (const vpn of vpns) {
            await this.newNode(connection, fwcloud, vpn.cn, node, 'OCL', vpn.id, 311);
          }
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the OpenVPN server nodes.
  public static openvpnServerTree(connection, fwcloud, firewall, node): Promise<void> {
    return new Promise((resolve, reject) => {
      // Get server OpenVPN configurations.
      const sql = `SELECT VPN.id,CRT.cn FROM openvpn VPN
			INNER JOIN crt CRT on CRT.id=VPN.crt
			WHERE VPN.firewall=${firewall} and VPN.openvpn is null`;
      connection.query(sql, async (error, vpns) => {
        if (error) return reject(error);
        if (vpns.length === 0) return resolve();

        try {
          for (const vpn of vpns) {
            const newNodeId = await this.newNode(
              connection,
              fwcloud,
              vpn.cn,
              node,
              'OSR',
              vpn.id,
              312,
            );
            await this.openvpnClientTree(connection, fwcloud, firewall, vpn.id, newNodeId);
          }
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the Wireguard client nodes.
  public static wireguardClientTree(
    connection: Query,
    fwcloud: number,
    firewall: number,
    server_vpn: number,
    node: unknown,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id,CRT.cn FROM wireguard VPN
      INNER JOIN crt CRT on CRT.id=VPN.crt
      WHERE VPN.firewall=${firewall} and VPN.wireguard=${server_vpn}`;
      connection.query(sql, async (error, vpns) => {
        if (error) return reject(error);
        if (vpns.length === 0) return resolve();

        try {
          for (const vpn of vpns) {
            await this.newNode(connection, fwcloud, vpn.cn, node, 'WGC', vpn.id, 321);
          }
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the Wireguard server nodes.
  public static wireguardServerTree(
    connection: Query,
    fwcloud: number,
    firewall: number,
    node: unknown,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id,CRT.cn FROM wireguard VPN
      INNER JOIN crt CRT on CRT.id=VPN.crt
      WHERE VPN.firewall=${firewall} and VPN.wireguard is null`;
      connection.query(sql, async (error, vpns) => {
        if (error) return reject(error);
        if (vpns.length === 0) return resolve();

        try {
          for (const vpn of vpns) {
            const newNodeId: unknown = await this.newNode(
              connection,
              fwcloud,
              vpn.cn,
              node,
              'WGS',
              vpn.id,
              322,
            );
            await this.wireguardClientTree(connection, fwcloud, firewall, vpn.id, newNodeId);
          }
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the routing nodes.
  public static routingTree(
    connection: any,
    fwcloud: number,
    firewall: number,
    node: number,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      let id3: any;
      try {
        const id2 = await this.newNode(connection, fwcloud, 'Routing', node, 'ROU', firewall, null);
        await this.newNode(connection, fwcloud, 'POLICY', id2, 'RR', firewall, null);
        id3 = await this.newNode(connection, fwcloud, 'TABLES', id2, 'RTS', firewall, null);
      } catch (error) {
        return reject(error);
      }

      const sql = `SELECT id,name FROM routing_table WHERE firewall=${firewall}`;
      connection.query(sql, async (error, tables) => {
        if (error) return reject(error);
        if (tables.length === 0) return resolve();

        try {
          for (const table of tables)
            await this.newNode(connection, fwcloud, table.name, id3, 'RT', table.id, null);
        } catch (error) {
          return reject(error);
        }
        resolve();
      });
    });
  }

  //Generate the system nodes.
  public static systemTree(
    connection: any,
    fwcloud: number,
    firewall: number,
    node: number,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const idSystem = await this.newNode(
          connection,
          fwcloud,
          'System',
          node,
          'SYS',
          firewall,
          null,
        );
        const idDHCP = await this.newNode(
          connection,
          fwcloud,
          'DHCP',
          idSystem,
          'S01',
          firewall,
          null,
        );
        await this.newNode(connection, fwcloud, 'Fixed Ips', idDHCP, 'S04', firewall, null);
        await this.newNode(connection, fwcloud, 'Keepalived', idSystem, 'S02', firewall, null);
        await this.newNode(connection, fwcloud, 'HAProxy', idSystem, 'S03', firewall, null);
        resolve();
      } catch (error) {
        return reject(error);
      }
    });
  }

  // Generate the VPN nodes.
  public static async vpnTree(
    connection: any,
    fwcloud: number,
    firewall: number,
    parentNode: number,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const vpnNode = await this.newNode(
          connection,
          fwcloud,
          'VPN',
          parentNode,
          'VPN',
          firewall,
          null,
        );

        const openVPNNode = await this.newNode(
          connection,
          fwcloud,
          'OpenVPN',
          vpnNode,
          'OPN',
          firewall,
          0,
        );
        await this.openvpnServerTree(connection, fwcloud, firewall, openVPNNode);

        const wireGuardNode = await this.newNode(
          connection,
          fwcloud,
          'WireGuard',
          vpnNode,
          'WG',
          firewall,
          0,
        );
        await this.wireguardServerTree(connection, fwcloud, firewall, wireGuardNode);
        await this.newNode(connection, fwcloud, 'IPSec', vpnNode, 'IS', firewall, 0);

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  }

  // //Generate the routing nodes.
  // public static makeSureRoutingTreeExists(connection: any, fwcloud: number, children: any): Promise<boolean> {
  //     return new Promise(async (resolve, reject) => {
  //         if (!children) return resolve(false);

  //         let treeReload = false;
  //         for (let i=0; i<children.length; i++) {
  //             if (children[i].node_type === 'FW' || children[i].node_type === 'CL') {
  //                 // Search for the routing node.
  //                 const grandchild = children[i].children;
  //                 let found = false;
  //                 for (let j=grandchild.length-1; j!=0; j--) {
  //                     if (grandchild[j].node_type === 'ROU') {
  //                         found = true;
  //                         break;
  //                     }
  //                 }

  //                 if (!found) {
  //                     // create the routing nodes.
  //                     let firewallId = 0;
  //                     for (let j=0; j < grandchild.length; j++) {
  //                         if (grandchild[j].node_type === 'FDI')
  //                             firewallId = grandchild[j].id_obj;
  //                     }
  //                     await this.routingTree(connection, fwcloud, firewallId, children[i].id);
  //                     treeReload = true;
  //                 }
  //             } else if (children[i].node_type === 'FD') // Recursive call for firewall folders.
  //                 treeReload = await this.makeSureRoutingTreeExists(connection, fwcloud, children[i].children);
  //         }

  //         resolve(treeReload);
  //     });
  // };

  //Add new TREE FIREWALL for a New Firewall
  public static insertFwc_Tree_New_firewall(fwcloud, nodeId, firewallId): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        // Obtain cluster data required for tree nodes creation.
        const sql = 'SELECT name FROM firewall WHERE id=' + firewallId + ' AND fwcloud=' + fwcloud;
        connection.query(sql, async (error, firewalls) => {
          if (error) return reject(error);
          if (firewalls.length !== 1)
            return reject(fwcError.other('Firewall with id ' + firewallId + ' not found'));

          try {
            // Create root firewall node
            const id1: any = await this.newNode(
              connection,
              fwcloud,
              firewalls[0].name,
              nodeId,
              'FW',
              firewallId,
              0,
            );

            let id2 = await this.newNode(
              connection,
              fwcloud,
              'IPv4 POLICY',
              id1,
              'FP',
              firewallId,
              null,
            );
            await this.newNode(connection, fwcloud, 'INPUT', id2, 'PI', firewallId, null);
            await this.newNode(connection, fwcloud, 'OUTPUT', id2, 'PO', firewallId, null);
            await this.newNode(connection, fwcloud, 'FORWARD', id2, 'PF', firewallId, null);
            await this.newNode(connection, fwcloud, 'SNAT', id2, 'NTS', firewallId, null);
            await this.newNode(connection, fwcloud, 'DNAT', id2, 'NTD', firewallId, null);

            id2 = await this.newNode(
              connection,
              fwcloud,
              'IPv6 POLICY',
              id1,
              'FP6',
              firewallId,
              null,
            );
            await this.newNode(connection, fwcloud, 'INPUT', id2, 'PI6', firewallId, null);
            await this.newNode(connection, fwcloud, 'OUTPUT', id2, 'PO6', firewallId, null);
            await this.newNode(connection, fwcloud, 'FORWARD', id2, 'PF6', firewallId, null);
            await this.newNode(connection, fwcloud, 'SNAT', id2, 'NS6', firewallId, null);
            await this.newNode(connection, fwcloud, 'DNAT', id2, 'ND6', firewallId, null);

            id2 = await this.newNode(connection, fwcloud, 'Interfaces', id1, 'FDI', firewallId, 10);
            await this.interfacesTree(connection, fwcloud, id2, firewallId, 'FW');

            await this.vpnTree(connection, fwcloud, firewallId, id1);

            await this.routingTree(connection, fwcloud, firewallId, id1);

            await this.systemTree(connection, fwcloud, firewallId, id1);
          } catch (error) {
            return reject(error);
          }
          resolve();
        });
      });
    });
  }

  // Create a new node for the new firewall into the NODES node of the cluster tree.
  public static insertFwc_Tree_New_cluster_firewall(
    fwcloud,
    clusterId,
    firewallId,
    firewallName,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT id FROM fwc_tree WHERE id_obj=' +
          '(select id from firewall where cluster=' +
          connection.escape(clusterId) +
          ' and fwmaster=1)' +
          ' AND fwcloud=' +
          connection.escape(fwcloud) +
          ' AND node_type="FCF"';
        connection.query(sql, async (error, nodes) => {
          if (error) return reject(error);
          if (nodes.length !== 1) return reject(fwcError.other('Node NODES not found'));

          await this.newNode(connection, fwcloud, firewallName, nodes[0].id, 'FW', firewallId, 0);
          resolve();
        });
      });
    });
  }

  //Add new TREE CLUSTER for a New CLuster
  public static insertFwc_Tree_New_cluster(fwcloud, nodeId, clusterId): Promise<void> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        // Obtain cluster data required for tree nodes creation.
        let sql =
          'SELECT C.id,C.name,F.id as fwmaster_id FROM cluster C' +
          ' INNER JOIN firewall F on F.cluster=C.id ' +
          ' WHERE C.id=' +
          clusterId +
          ' AND C.fwcloud=' +
          fwcloud +
          ' AND F.fwmaster=1';
        connection.query(sql, async (error, clusters) => {
          if (error) return reject(error);
          if (clusters.length !== 1)
            return reject(fwcError.other('Cluster with id ' + clusterId + ' not found'));

          try {
            // Create root cluster node
            const id1: any = await this.newNode(
              connection,
              fwcloud,
              clusters[0].name,
              nodeId,
              'CL',
              clusters[0].id,
              100,
            );

            let id2 = await this.newNode(
              connection,
              fwcloud,
              'IPv4 POLICY',
              id1,
              'FP',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'INPUT',
              id2,
              'PI',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'OUTPUT',
              id2,
              'PO',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'FORWARD',
              id2,
              'PF',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'SNAT',
              id2,
              'NTS',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'DNAT',
              id2,
              'NTD',
              clusters[0].fwmaster_id,
              null,
            );

            id2 = await this.newNode(
              connection,
              fwcloud,
              'IPv6 POLICY',
              id1,
              'FP6',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'INPUT',
              id2,
              'PI6',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'OUTPUT',
              id2,
              'PO6',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'FORWARD',
              id2,
              'PF6',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'SNAT',
              id2,
              'NS6',
              clusters[0].fwmaster_id,
              null,
            );
            await this.newNode(
              connection,
              fwcloud,
              'DNAT',
              id2,
              'ND6',
              clusters[0].fwmaster_id,
              null,
            );

            id2 = await this.newNode(
              connection,
              fwcloud,
              'Interfaces',
              id1,
              'FDI',
              clusters[0].fwmaster_id,
              10,
            );
            await this.interfacesTree(connection, fwcloud, id2, clusters[0].fwmaster_id, 'FW');

            await this.vpnTree(connection, fwcloud, clusters[0].fwmaster_id, id1);

            await this.routingTree(connection, fwcloud, clusters[0].fwmaster_id, id1);

            await this.systemTree(connection, fwcloud, clusters[0].fwmaster_id, id1);

            id2 = await this.newNode(
              connection,
              fwcloud,
              'NODES',
              id1,
              'FCF',
              clusters[0].fwmaster_id,
              null,
            );

            // Create the nodes for the cluster firewalls.
            sql =
              'SELECT id,name FROM firewall WHERE cluster=' + clusterId + ' AND fwcloud=' + fwcloud;
            connection.query(sql, async (error, firewalls) => {
              if (error) return reject(error);
              if (firewalls.length === 0)
                return reject(
                  fwcError.other('No firewalls found for cluster with id ' + clusters[0].id),
                );

              for (const firewall of firewalls)
                await this.newNode(connection, fwcloud, firewall.name, id2, 'FW', firewall.id, 0);

              resolve();
            });
          } catch (error) {
            return reject(error);
          }
        });
      });
    });
  }

  //CONVERT TREE FIREWALL TO CLUSTER for a New CLuster
  public static updateFwc_Tree_convert_firewall_cluster(
    fwcloud,
    node_id,
    idcluster,
    idfirewall,
    AllDone,
  ) {
    db.get((error, connection) => {
      if (error) {
        return AllDone(error, null);
      }

      this.getFirewallNodeId(idfirewall, (datafw) => {
        const firewallNode = datafw;

        //Select Parent Node by id
        const sql =
          'SELECT T1.* FROM ' +
          tableName +
          ' T1  where T1.id=' +
          connection.escape(node_id) +
          ' AND T1.fwcloud=' +
          connection.escape(fwcloud) +
          ' order by T1.node_order';
        logger().debug(sql);
        connection.query(sql, (error, rows) => {
          if (error) return AllDone(error, null);

          if (rows[0].node_type != 'FDF' && rows[0].node_type != 'FD')
            return AllDone(fwcError.other('Bad folder type'), null);

          //For each node Select Objects by  type
          if (rows) {
            asyncMod.forEachSeries(
              rows,
              (row, callback) => {
                //logger().debug(row);
                //logger().debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);
                const tree_node = new fwc_tree_node(row);
                //Añadimos nodos CLUSTER del CLOUD
                const sqlnodes =
                  'SELECT id,name,fwcloud FROM cluster WHERE id=' + connection.escape(idcluster);
                //logger().debug(sqlnodes);
                connection.query(sqlnodes, (error, rowsnodes) => {
                  if (error) callback(error, null);
                  else {
                    let i = 0;
                    if (rowsnodes) {
                      asyncMod.forEachSeries(rowsnodes, (rnode, callback2) => {
                        i++;
                        //Insertamos nodos Cluster
                        const sqlinsert =
                          'INSERT INTO ' +
                          tableName +
                          ' (name, id_parent, node_type, id_obj, obj_type, fwcloud) ' +
                          ' VALUES (' +
                          connection.escape(rnode.name) +
                          ',' +
                          connection.escape(row.id) +
                          ',"CL",' +
                          connection.escape(rnode.id) +
                          ',100,' +
                          connection.escape(fwcloud) +
                          ')';
                        //logger().debug(sqlinsert);
                        let parent_cluster;

                        connection.query(sqlinsert, (error, result) => {
                          if (error) {
                            logger().debug(
                              'ERROR CLUSTER INSERT : ' +
                                rnode.id +
                                ' - ' +
                                rnode.name +
                                ' -> ' +
                                error,
                            );
                          } else {
                            logger().debug(
                              'INSERT CLUSTER OK NODE: ' +
                                rnode.id +
                                ' - ' +
                                rnode.name +
                                '  --> FWCTREE: ' +
                                result.insertId,
                            );
                            parent_cluster = result.insertId;

                            const parent_FP = 0;

                            //update ALL FIREWALL NODES
                            const sqlinsert =
                              'UPDATE ' +
                              tableName +
                              ' SET id_parent=' +
                              parent_cluster +
                              ' WHERE id_parent=' +
                              firewallNode;
                            logger().debug(sqlinsert);
                            connection.query(sqlinsert, (error, result) => {
                              if (error) logger().debug('ERROR ALL NODES : ' + error);
                            });
                          }

                          //Insertamos nodo NODE FIREWALLS
                          const sqlinsert =
                            'INSERT INTO ' +
                            tableName +
                            '(name, id_parent, node_type, id_obj, obj_type, fwcloud) ' +
                            ' VALUES (' +
                            '"NODES",' +
                            parent_cluster +
                            ',"FCF",' +
                            connection.escape(idfirewall) +
                            ',null,' +
                            connection.escape(rnode.fwcloud) +
                            ')';
                          connection.query(sqlinsert, (error, result) => {
                            if (error) logger().debug('ERROR RR : ' + error);
                            else {
                              const nodes_cluster = result.insertId;
                              //update  FIREWALL NODE
                              const sqlinsert =
                                'UPDATE ' +
                                tableName +
                                ' SET id_parent=' +
                                nodes_cluster +
                                ' WHERE id=' +
                                firewallNode;
                              logger().debug(sqlinsert);
                              connection.query(sqlinsert, (error, result) => {
                                if (error) logger().debug('ERROR FIREWALL NODE : ' + error);
                              });
                            }
                          });
                        });
                        callback2();
                      });
                    }
                  }
                });
                callback();
              },
              function (err) {
                if (err) AllDone(err, null);
                else AllDone(null, { result: true });
              },
            );
          } else AllDone(null, { result: true });
        });
      });
    });
  }

  //CONVERT TREE CLUSTER TO FIREWALL for a New Firewall
  public static updateFwc_Tree_convert_cluster_firewall(
    fwcloud,
    node_id,
    idcluster,
    idfirewall,
    AllDone,
  ) {
    db.get((error, connection) => {
      if (error) {
        return AllDone(error, null);
      }

      this.getFirewallNodeId(idfirewall, (datafw) => {
        const firewallNode = datafw;
        //Select Parent Node CLUSTERS
        const sql =
          'SELECT T1.* FROM ' +
          tableName +
          ' T1  where T1.id=' +
          connection.escape(node_id) +
          ' AND T1.fwcloud=' +
          connection.escape(fwcloud) +
          ' order by T1.node_order';

        connection.query(sql, (error, rows) => {
          if (error) return AllDone(error, null);

          if (rows[0].node_type != 'FDF' && rows[0].node_type != 'FD')
            return AllDone(fwcError.other('Bad folder type'), null);

          //For each node Select Objects by  type
          if (rows && rows.length > 0) {
            const row = rows[0];
            //logger().debug(row);
            //logger().debug("---> DENTRO de NODO: " + row.name + " - " + row.node_type);

            //SEARCH IDNODE for CLUSTER
            const sql =
              'SELECT T1.* FROM ' +
              tableName +
              ' T1  where T1.node_type="CL" and T1.id_parent=' +
              row.id +
              ' AND T1.fwcloud=' +
              connection.escape(fwcloud) +
              ' AND id_obj=' +
              idcluster;
            connection.query(sql, (error, rowsCL) => {
              if (error) {
                AllDone(error, null);
              } else if (rowsCL && rowsCL.length > 0) {
                const clusterNode = rowsCL[0].id;

                //update ALL NODES UNDER CLUSTER to FIREWALL
                const sqlinsert =
                  'UPDATE ' +
                  tableName +
                  ' SET id_parent=' +
                  firewallNode +
                  ' WHERE id_parent=' +
                  clusterNode +
                  ' AND node_type<>"FCF"';
                connection.query(sqlinsert, (error, result) => {
                  if (error) logger().debug('ERROR ALL NODES : ' + error);
                });

                //SEARCH node NODES
                const sql =
                  'SELECT T1.* FROM ' +
                  tableName +
                  ' T1  where T1.node_type="FCF" and T1.id_parent=' +
                  clusterNode +
                  ' AND T1.fwcloud=' +
                  connection.escape(fwcloud);
                logger().debug(sql);
                connection.query(sql, (error, rowsN) => {
                  if (error) {
                    AllDone(error, null);
                  } else if (rowsN && rowsN.length > 0) {
                    const idNodes = rowsN[0].id;
                    //Remove nodo NODES
                    const sqldel =
                      'DELETE FROM  ' +
                      tableName +
                      ' ' +
                      ' WHERE node_type= "FCF" and id_parent=' +
                      clusterNode;
                    logger().debug(sqldel);
                    connection.query(sqldel, (error, result) => {
                      if (error) logger().debug('ERROR FCF : ' + error);
                    });
                    //SEARCH IDNODE for FIREWALLS NODE
                    const sql =
                      'SELECT T1.* FROM ' +
                      tableName +
                      ' T1  where T1.node_type="FDF" and T1.id_parent is null AND T1.fwcloud=' +
                      connection.escape(fwcloud);
                    logger().debug(sql);
                    connection.query(sql, (error, rowsF) => {
                      const firewallsNode = rowsF[0].id;
                      //update  FIREWALL under NODES to FIREWALLS NODE
                      const sqlinsert =
                        'UPDATE ' +
                        tableName +
                        ' SET id_parent=' +
                        node_id +
                        ' WHERE id=' +
                        firewallNode;
                      logger().debug(sqlinsert);
                      connection.query(sqlinsert, (error, result) => {
                        if (error) logger().debug('ERROR FIREWALL NODE : ' + error);
                        else {
                          //Remove nodo Firewalls Slaves
                          const sqldel =
                            'DELETE FROM  ' +
                            tableName +
                            ' ' +
                            ' WHERE node_type= "FW"  and id_parent=' +
                            idNodes;
                          logger().debug(sqldel);
                          connection.query(sqldel, (error, result) => {
                            if (error) logger().debug('ERROR FW - FCF : ' + error);
                            else {
                              AllDone(null, { result: true });
                            }
                          });
                        }
                      });
                    });
                  }
                });
              } else AllDone(error, null);
            });
          } else AllDone(null, { result: true });
        });
      });
    });
  }

  //Add new NODE from IPOBJ or Interface
  public static insertFwc_TreeOBJ(req, node_parent, node_order, node_type, node_Data) {
    return new Promise((resolve, reject) => {
      const fwc_treeData = {
        id: null,
        name: node_Data.name,
        id_parent: node_parent,
        node_type: node_type,
        obj_type: node_Data.type,
        id_obj: node_Data.id,
        fwcloud: req.body.fwcloud,
      };

      // Firewall and host interfaces.
      if ((node_Data.type === 10 || node_Data.type === 11) && node_Data.labelName)
        fwc_treeData.name += ' [' + node_Data.labelName + ']';
      // Interface address.
      if (node_Data.type === 5 && node_Data.interface)
        fwc_treeData.name += ' (' + node_Data.address + ')';

      req.dbCon.query(`INSERT INTO ${tableName} SET ?`, fwc_treeData, (error, result) => {
        if (error) return reject(error);
        this.OrderList(node_order, req.body.fwcloud, node_parent, 999999, result.insertId);
        //devolvemos la última id insertada
        resolve(result.insertId);
      });
    });
  }

  //Update NODE from user
  public static updateFwc_Tree(nodeTreeData, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql =
        'UPDATE ' +
        tableName +
        ' SET ' +
        ' name = ' +
        connection.escape(nodeTreeData.name) +
        ' ' +
        ' WHERE id = ' +
        nodeTreeData.id;
      connection.query(sql, (error, result) => {
        if (error) {
          callback(error, null);
        } else {
          callback(null, { result: true });
        }
      });
    });
  }

  //Update NODE from FIREWALL UPDATE
  public static updateFwc_Tree_Firewall(dbCon, fwcloud, FwData): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET name=${dbCon.escape(FwData.name)}
			WHERE id_obj=${FwData.id} AND fwcloud=${fwcloud} AND node_type='FW'`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Update NODE from CLUSTER UPDATE
  public static updateFwc_Tree_Cluster(dbCon, fwcloud, Data): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `UPDATE ${tableName} SET name=${dbCon.escape(Data.name)}
			WHERE id_obj=${Data.id} AND fwcloud=${fwcloud} AND node_type='CL'`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  //Update NODE from IPOBJ or INTERFACE UPDATE
  public static updateFwc_Tree_OBJ(req, ipobjData) {
    return new Promise((resolve, reject) => {
      let name = ipobjData.name;
      // Firewall and host interfaces.
      if ((ipobjData.type === 10 || ipobjData.type === 11) && ipobjData.labelName)
        name += ' [' + ipobjData.labelName + ']';
      // Interface address.
      if (ipobjData.type === 5 && ipobjData.interface) name += ' (' + ipobjData.address + ')';

      const sql = `UPDATE ${tableName} SET name=${req.dbCon.escape(name)}
			WHERE node_type NOT LIKE "F%" AND id_obj=${ipobjData.id} AND obj_type=${ipobjData.type} AND fwcloud=${req.body.fwcloud}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);

        if (result.affectedRows > 0) resolve({ result: true });
        else resolve({ result: false });
      });
    });
  }

  //Remove NODE FROM GROUP with id_obj to remove
  public static deleteFwc_TreeGroupChild(dbCon, fwcloud, id_group, id_obj): Promise<void> {
    return new Promise((resolve, reject) => {
      const sql = `DELETE T.* FROM ${tableName} T INNER JOIN ${tableName} T2 ON T.id_parent=T2.id 
			WHERE T.fwcloud=${fwcloud} AND T.id_obj=${id_obj} AND T2.id_obj=${id_group}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  private static getFirewallNodeId(idfirewall, callback) {
    let ret;
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sql =
        'SELECT id FROM  ' + tableName + '  where node_type="FW" AND id_obj = ' + idfirewall;
      connection.query(sql, (error, rows) => {
        if (rows.length > 0) {
          ret = rows[0].id;
        } else {
          ret = 0;
        }
        callback(ret);
      });
    });
  }

  private static OrderList(new_order, fwcloud, id_parent, old_order, id) {
    return new Promise<any>((resolve, reject) => {
      let increment = '+1';
      let order1 = new_order;
      let order2 = old_order;
      if (new_order > old_order) {
        increment = '-1';
        order1 = old_order;
        order2 = new_order;
      }

      db.get((error, connection) => {
        if (error) reject(error);
        const sql =
          'UPDATE ' +
          tableName +
          ' SET ' +
          'node_order = node_order' +
          increment +
          ' WHERE (fwcloud = ' +
          connection.escape(fwcloud) +
          ' OR fwcloud is null) ' +
          ' AND id_parent=' +
          connection.escape(id_parent) +
          ' AND node_order>=' +
          order1 +
          ' AND node_order<=' +
          order2 +
          ' AND id<>' +
          connection.escape(id);
        connection.query(sql, (error, result) => {
          if (error) {
            reject(error);
          }

          resolve(result);
        });
      });
    });
  }

  //Busca todos los padres donde aparece el IPOBJ a borrar
  //Ordena todos los nodos padres sin contar el nodo del IPOBJ
  //Order Tree Node by IPOBJ
  public static orderTreeNodeDeleted(dbCon, fwcloud, id_obj_deleted) {
    return new Promise((resolve, reject) => {
      const sqlParent =
        'SELECT DISTINCT id_parent FROM ' +
        tableName +
        ' WHERE (fwcloud=' +
        fwcloud +
        ' OR fwcloud is null) AND id_obj=' +
        id_obj_deleted +
        ' order by id_parent';
      dbCon.query(sqlParent, (error, rows) => {
        if (error) return reject(error);

        if (rows.length > 0) {
          asyncMod.map(
            rows,
            (row, callback1) => {
              const id_parent = row.id_parent;
              const sqlNodes =
                'SELECT * FROM ' +
                tableName +
                ' WHERE (fwcloud=' +
                fwcloud +
                ' OR fwcloud is null) AND id_parent=' +
                id_parent +
                ' AND id_obj<>' +
                id_obj_deleted +
                ' order by id_parent, node_order';
              dbCon.query(sqlNodes, (error, rowsnodes) => {
                if (error) return reject(error);

                if (rowsnodes.length > 0) {
                  let order = 0;
                  asyncMod.map(
                    rowsnodes,
                    (rowNode, callback2) => {
                      order++;
                      const sql =
                        'UPDATE ' +
                        tableName +
                        ' SET node_order=' +
                        order +
                        ' WHERE id_parent = ' +
                        id_parent +
                        ' AND id=' +
                        rowNode.id;
                      dbCon.query(sql, (error, result) => {
                        if (error) {
                          callback2();
                        } else {
                          callback2();
                        }
                      });
                    }, //Fin de bucle
                    function (err) {
                      return resolve({ result: true });
                    },
                  );
                } else callback1();
              });
            }, //Fin de bucle
            function (err) {
              return resolve({ result: true });
            },
          );
        } else return resolve({ result: false });
      });
    });
  }
  //Order Tree Node by IPOBJ
  public static orderTreeNode(fwcloud, id_parent, callback) {
    db.get((error, connection) => {
      if (error) callback(error, null);
      const sqlNodes =
        'SELECT * FROM ' +
        tableName +
        ' WHERE (fwcloud=' +
        connection.escape(fwcloud) +
        ' OR fwcloud is null) AND id_parent=' +
        connection.escape(id_parent) +
        '  order by node_order';
      logger().debug(sqlNodes);
      connection.query(sqlNodes, (error, rowsnodes) => {
        if (rowsnodes.length > 0) {
          let order = 0;
          asyncMod.map(
            rowsnodes,
            (rowNode, callback2) => {
              order++;
              const sql =
                'UPDATE ' +
                tableName +
                ' SET node_order=' +
                order +
                ' WHERE id_parent = ' +
                connection.escape(id_parent) +
                ' AND id=' +
                connection.escape(rowNode.id);
              logger().debug(sql);
              connection.query(sql, (error, result) => {
                if (error) {
                  callback2();
                } else {
                  callback2();
                }
              });
            }, //Fin de bucle
            function (err) {
              callback(null, { result: true });
            },
          );
        } else callback(null, { result: true });
      });
    });
  }
}
