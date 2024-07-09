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

import Model from '../Model';
import { PrimaryColumn, PrimaryGeneratedColumn, Column, Entity, OneToMany } from 'typeorm';
import { User } from './User';
const tableName: string = 'customer';

@Entity(tableName)
export class Customer extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  addr: string;

  @Column()
  phone: string;

  @Column()
  email: string;

  @Column()
  web: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @OneToMany((type) => User, (user) => user.customer)
  users: Array<User>;

  public getTableName(): string {
    return tableName;
  }

  //Add new customer
  public static _insert(req) {
    return new Promise(async (resolve, reject) => {
      //New object with customer data
      const customerData = {
        id: req.body.customer,
        addr: req.body.addr,
        phone: req.body.phone,
        name: req.body.name,
        email: req.body.email,
        web: req.body.web,
      };

      req.dbCon.query(`INSERT INTO ${tableName} SET ?`, customerData, (error, result) => {
        if (error) return reject(error);
        resolve(result.insertId);
      });
    });
  }

  public static existsId = (dbCon, customer) => {
    return new Promise(async (resolve, reject) => {
      dbCon.query(`select id from ${tableName} where id=${customer}`, (error, result) => {
        if (error) return reject(error);
        if (result.length > 0) return resolve(true);
        resolve(false);
      });
    });
  };

  public static existsName = (dbCon, name) => {
    return new Promise(async (resolve, reject) => {
      dbCon.query(
        `select id from ${tableName} where name=${dbCon.escape(name)}`,
        (error, result) => {
          if (error) return reject(error);
          if (result.length > 0) return resolve(result[0].id);
          resolve(false);
        },
      );
    });
  };

  //Update customer
  public static _update = (req) => {
    return new Promise<void>(async (resolve, reject) => {
      const sql = `UPDATE ${tableName} SET name=${req.dbCon.escape(req.body.name)},
                email=${req.dbCon.escape(req.body.email)},
                addr=${req.dbCon.escape(req.body.addr)},
                phone=${req.dbCon.escape(req.body.phone)},
                web=${req.dbCon.escape(req.body.web)}
                WHERE id=${req.body.customer}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  };

  //Update customer
  public static get(req) {
    return new Promise(async (resolve, reject) => {
      const sql = req.body.customer
        ? `select * from ${tableName} WHERE id=${req.body.customer}`
        : `select id,name from ${tableName}`;
      req.dbCon.query(sql, (error, result) => {
        if (error) return reject(error);
        resolve(result);
      });
    });
  }

  public static _delete(req): Promise<void> {
    return new Promise(async (resolve, reject) => {
      req.dbCon.query(`delete from ${tableName} where id=${req.body.customer}`, (error, result) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static searchUsers(req) {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `select count(*) as n from user where customer =${req.body.customer}`,
        async (error, result) => {
          if (error) return reject(error);

          if (result[0].n > 0) resolve({ result: true, restrictions: { CustomerHasUsers: true } });
          else resolve({ result: false });
        },
      );
    });
  }

  public static lastCustomer(req) {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `select count(*) as n from ${tableName} where id!=${req.body.customer}`,
        async (error, result) => {
          if (error) return reject(error);

          if (result[0].n === 0) resolve({ result: true, restrictions: { LastCustomer: true } });
          else resolve({ result: false });
        },
      );
    });
  }
}
