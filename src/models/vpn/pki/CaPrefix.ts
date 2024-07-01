/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Tree } from '../../../models/tree/Tree';
import { Crt } from '../../../models/vpn/pki/Crt';
import Model from '../../Model';
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Ca } from './Ca';
const fwcError = require('../../../utils/error_table');

const tableName: string = 'ca_prefix';

@Entity(tableName)
export class CaPrefix extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ name: 'ca' })
  caId: number;

  @ManyToOne((type) => Ca, (ca) => ca.prefixes)
  @JoinColumn({
    name: 'ca',
  })
  ca: Ca;

  public getTableName(): string {
    return tableName;
  }

  // Validate new prefix container.
  public static existsCrtPrefix(req) {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `SELECT id FROM ca_prefix WHERE ca=${req.body.ca} AND name=${req.dbCon.escape(req.body.name)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length > 0 ? true : false);
        },
      );
    });
  }

  // Get all prefixes for the indicated CA.
  public static getPrefixes(dbCon, ca) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `SELECT id,name FROM ca_prefix WHERE ca=${ca}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  // Get prefix info.
  public static getPrefixInfo(dbCon, fwcloud, prefix) {
    return new Promise((resolve, reject) => {
      const sql = `select CA.fwcloud,PRE.*,CA.cn from ca_prefix PRE 
      inner join ca CA on CA.id=PRE.ca
      where CA.fwcloud=${fwcloud} and PRE.id=${prefix}`;
      dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  // Fill prefix node with matching entries.
  public static fillPrefixNodeCA(
    dbCon,
    fwcloud,
    ca,
    name,
    parent,
    node,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      // Move all affected nodes into the new prefix container node.
      const prefix = dbCon.escape(name).slice(1, -1);
      let sql = `SELECT id,type,cn,SUBSTRING(cn,${prefix.length + 1},255) as sufix FROM crt
      WHERE ca=${ca} AND cn LIKE '${prefix}%'`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        try {
          for (const row of result)
            await Tree.newNode(
              dbCon,
              fwcloud,
              row.sufix,
              node,
              'CRT',
              row.id,
              row.type === 1 ? 301 : 302,
            );
        } catch (error) {
          return reject(error);
        }

        // Remove from root CA node the nodes that match de prefix.
        sql = `DELETE FROM fwc_tree WHERE id_parent=${parent} AND (obj_type=301 OR obj_type=302) AND name LIKE '${prefix}%'`;
        dbCon.query(sql, (error, result) => {
          if (error) return reject(error);
          resolve();
        });
      });
    });
  }

  // Apply CRT prefix to tree node.
  public static applyCrtPrefixes(req, ca): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Search for the CA node tree.
        const node: any = Tree.getNodeInfo(
          req.dbCon,
          req.body.fwcloud,
          'CA',
          ca,
        );
        if (node.length !== 1)
          throw fwcError.other(`Found ${node.length} CA nodes, awaited 1`);
        const node_id = node[0].id;

        // Remove all nodes under the CA node.
        Tree.deleteNodesUnderMe(req.dbCon, req.body.fwcloud, node_id);

        // Generate all the CRT tree nodes under the CA node.
        const crt_list: any = Crt.getCRTlist(req.dbCon, ca);
        for (const crt of crt_list)
          Tree.newNode(
            req.dbCon,
            req.body.fwcloud,
            crt.cn,
            node_id,
            'CRT',
            crt.id,
            crt.type === 1 ? 301 : 302,
          );

        // Create the nodes for all the prefixes.
        const prefix_list: any = this.getPrefixes(req.dbCon, ca);
        for (const prefix of prefix_list) {
          const id = Tree.newNode(
            req.dbCon,
            req.body.fwcloud,
            prefix.name,
            node_id,
            'PRE',
            prefix.id,
            400,
          );
          this.fillPrefixNodeCA(
            req.dbCon,
            req.body.fwcloud,
            ca,
            prefix.name,
            node_id,
            id,
          );
        }

        resolve();
      } catch (error) {
        return reject(error);
      }
    });
  }

  // Add new prefix container.
  public static createCrtPrefix(req) {
    return new Promise((resolve, reject) => {
      const prefixData = {
        id: null,
        name: req.body.name,
        ca: req.body.ca,
      };
      req.dbCon.query(
        `INSERT INTO ca_prefix SET ?`,
        prefixData,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  // Modify a CRT Prefix container.
  public static modifyCrtPrefix(req): Promise<void> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `UPDATE ca_prefix SET name=${req.dbCon.escape(req.body.name)} WHERE id=${req.body.prefix}`,
        (error, result) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }

  // Delete CRT Prefix container.
  public static deleteCrtPrefix(req): Promise<void> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `DELETE from ca_prefix WHERE id=${req.body.prefix}`,
        (error, result) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }
}
