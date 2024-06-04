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

import Model from "../../Model";
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { Ca } from "./Ca";
import { OpenVPN } from "../openvpn/OpenVPN";

const fwcError = require("../../../utils/error_table");

const tableName: string = "crt";

@Entity(tableName)
export class Crt extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  cn: string;

  @Column()
  days: number;

  @Column()
  type: number;

  @Column()
  comment: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: Date;

  @Column()
  updated_by: Date;

  @Column({ name: "ca" })
  caId: number;

  @ManyToOne((type) => Ca, (ca) => ca.crts)
  @JoinColumn({
    name: "ca",
  })
  ca: Ca;

  @OneToMany((type) => OpenVPN, (openVPN) => openVPN.crt)
  openVPNs: Array<OpenVPN>;

  public getTableName(): string {
    return tableName;
  }

  // Validate if crt exits.
  public static existsCRT(dbCon, ca, cn) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `SELECT id FROM ${tableName} WHERE ca=${ca} AND cn=${dbCon.escape(cn)}`,
        (error, result) => {
          if (error) return reject(error);
          resolve(result.length > 0 ? true : false);
        },
      );
    });
  }

  // Insert new certificate in the database.
  public static createCRT(req) {
    return new Promise((resolve, reject) => {
      const cert = {
        ca: req.body.ca,
        cn: req.body.cn,
        days: req.body.days,
        type: req.body.type,
        comment: req.body.comment,
      };
      req.dbCon.query("insert into crt SET ?", cert, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  // Delete CRT.
  public static deleteCRT(req): Promise<void> {
    return new Promise((resolve, reject) => {
      // Verify that the CA can be deleted.
      req.dbCon.query(
        "SELECT count(*) AS n FROM openvpn WHERE crt=" + req.body.crt,
        (error, result) => {
          if (error) return reject(error);
          if (result[0].n > 0)
            return reject(
              fwcError.other(
                "This certificate can not be removed because it is used in a OpenVPN setup",
              ),
            );

          req.dbCon.query(
            "DELETE FROM crt WHERE id=" + req.body.crt,
            (error, result) => {
              if (error) return reject(error);
              resolve();
            },
          );
        },
      );
    });
  }

  // Get database certificate data.
  public static getCRTdata(dbCon, crt) {
    return new Promise((resolve, reject) => {
      dbCon.query("SELECT * FROM crt WHERE id=" + crt, (error, result) => {
        if (error) return reject(error);
        if (result.length !== 1) return reject(fwcError.NOT_FOUND);

        resolve(result[0]);
      });
    });
  }

  // Get certificate list for a CA.
  public static getCRTlist(dbCon, ca) {
    return new Promise((resolve, reject) => {
      dbCon.query(`SELECT * FROM crt WHERE ca=${ca}`, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static searchCRTInOpenvpn(dbCon, fwcloud, crt) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT VPN.id FROM openvpn VPN
        INNER JOIN crt CRT ON CRT.id=VPN.crt
        INNER JOIN ca CA ON CA.id=CRT.ca
        WHERE CA.fwcloud=${fwcloud} AND CRT.id=${crt}`;
      dbCon.query(sql, async (error, result) => {
        if (error) return reject(error);

        if (result.length > 0)
          resolve({ result: true, restrictions: { crtUsedInOpenvpn: true } });
        else resolve({ result: false });
      });
    });
  }
}
