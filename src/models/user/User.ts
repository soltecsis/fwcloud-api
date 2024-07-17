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

import db from '../../database/database-manager';
import Model from '../Model';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { FwCloud } from '../fwcloud/FwCloud';
import { Ca } from '../vpn/pki/Ca';
import { Customer } from './Customer';
import { Tfa } from './Tfa';
import Query from '../../database/Query';

import fwcError from '../../utils/error_table';

const bcrypt = require('bcryptjs');

const tableName: string = 'user';

@Entity(tableName)
export class User extends Model {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column()
  enabled: number;

  @Column()
  role: number;

  @Column()
  allowed_from: string;

  @Column()
  last_login: Date;

  @Column()
  confirmation_token: string;

  @Column()
  created_at: Date;

  @Column()
  updated_at: Date;

  @Column()
  created_by: number;

  @Column()
  updated_by: number;

  @ManyToMany(() => FwCloud, (fwcloud) => fwcloud.users)
  fwClouds: Array<FwCloud>;

  @OneToMany(() => Ca, (ca) => ca.created_by)
  created_cas: Array<Ca>;

  @OneToMany(() => Ca, (ca) => ca.updated_by)
  updated_cas: Array<Ca>;

  @Column({ name: 'customer' })
  customerId: number;

  @ManyToOne(() => Customer, (customer) => customer.users)
  @JoinColumn({
    name: 'customer',
  })
  customer: Customer;

  @OneToOne(() => Tfa, (tfa) => tfa.user)
  tfa: Tfa;

  public getTableName(): string {
    return tableName;
  }

  //Get user by  username
  public static getUserName(customer: number, username: string): Promise<Array<User>> {
    return new Promise((resolve, reject) => {
      db.get((error, connection) => {
        if (error) return reject(error);

        const sql =
          'SELECT * FROM user ' +
          'WHERE customer=' +
          connection.escape(customer).toString() +
          ' AND username =' +
          connection.escape(username).toString();

        connection.query(sql, (error, row: Array<User>) => {
          if (error) reject(error);
          else resolve(row);
        });
      });
    });
  }

  public static getAllAdminUserIds(req): Promise<Array<{ id: number }>> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `select id from ${tableName} where role=1`,
        (error: Error, result: Array<{ id: number }>) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  //Add new user
  public static _insert(req) {
    return new Promise((resolve, reject) => {
      //New object with customer data
      const salt = bcrypt.genSaltSync(10);
      const userData = {
        id: null,
        customer: req.body.customer,
        name: req.body.name,
        email: req.body.email,
        username: req.body.username,
        password: bcrypt.hashSync(req.body.customer + req.body.username + req.body.password, salt),
        enabled: req.body.enabled,
        role: req.body.role,
        allowed_from: req.body.allowed_from,
      };

      try {
        req.dbCon.query(`INSERT INTO ${tableName} SET ?`, userData, (error: Error, result) => {
          if (error) return reject(error);
          resolve(result.insertId);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  public static existsCustomerUserName(
    dbCon: Query,
    customer: number,
    username: string,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id from ${tableName} where customer=${customer} and username=${dbCon.escape(username)}`,
        (error, result: Array<{ id: number }>) => {
          if (error) return reject(error);
          if (result.length > 0) return resolve(true);
          resolve(false);
        },
      );
    });
  }

  public static existsCustomerUserNameOtherId(
    dbCon: Query,
    customer: number,
    username: string,
    user: number,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id from ${tableName} where customer=${customer} and username=${dbCon.escape(username)} and id!=${user}`,
        (error, result: Array<{ id: number }>) => {
          if (error) return reject(error);
          if (result.length > 0) return resolve(true);
          resolve(false);
        },
      );
    });
  }

  public static existsCustomerUserId(
    dbCon: Query,
    customer: number,
    user: number,
  ): Promise<boolean> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `select id from ${tableName} where customer=${customer} and id=${user}`,
        (error: Error, result: Array<{ id: number }>) => {
          if (error) return reject(error);
          if (result.length > 0) return resolve(true);
          resolve(false);
        },
      );
    });
  }

  public static isAdmin(req): Promise<boolean> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `select role from ${tableName} where customer=${req.body.customer} and id=${req.body.user}`,
        (error: Error, result: Array<{ role: number }>) => {
          if (error) return reject(error);
          if (result.length === 0) return reject(fwcError.NOT_FOUND);

          resolve(result[0].role === 1 ? true : false);
        },
      );
    });
  }

  public static async isLoggedUserAdmin(req): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!req.session || !req.session.user_id) {
        reject(fwcError.NOT_FOUND);
      }

      req.dbCon.query(
        `select role from ${tableName} where id=${req.session.user_id}`,
        (error: Error, result: Array<{ role: number }>) => {
          if (error) return reject(error);
          if (result.length === 0) reject(fwcError.NOT_FOUND);

          resolve(result[0].role === 1 ? true : false);
        },
      );
    });
  }

  public static _update(req): Promise<void> {
    return new Promise((resolve, reject) => {
      let crypt_pass = '';
      if (req.body.password) {
        const salt = bcrypt.genSaltSync(10);
        crypt_pass = bcrypt.hashSync(
          req.body.customer + req.body.username + req.body.password,
          salt,
        );
      }

      const sql = `UPDATE ${tableName} SET customer=${req.body.customer},
                name=${req.dbCon.escape(req.body.name)},
                email=${req.dbCon.escape(req.body.email)},
                username=${req.dbCon.escape(req.body.username)},
                ${crypt_pass ? `password=${req.dbCon.escape(crypt_pass)},` : ``}
                enabled=${req.body.enabled},
                role=${req.body.role},
                allowed_from=${req.dbCon.escape(req.body.allowed_from)}
                WHERE id=${req.body.user}`;
      req.dbCon.query(sql, (error) => {
        if (error) return reject(error);
        resolve();
      });
    });
  }

  public static changeLoggedUserPass(req): Promise<void> {
    return new Promise((resolve, reject) => {
      const salt = bcrypt.genSaltSync(10);
      const crypt_pass = bcrypt.hashSync(
        req.session.customer_id + req.session.username + req.body.password,
        salt,
      );

      req.dbCon.query(
        `UPDATE ${tableName} SET password=${req.dbCon.escape(crypt_pass)} WHERE id=${req.session.user_id}`,
        (error) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }

  public static get(req): Promise<
    Array<{
      id: number;
      customer: number;
      name: string;
      email: string;
      username: string;
      enabled: number;
      role: number;
      allowed_from: string;
      last_login: Date;
    }>
  > {
    return new Promise((resolve, reject) => {
      let sql = '';

      if (req.body.user)
        sql = `select id,customer,name,email,username,enabled,role,allowed_from,last_login from ${tableName} where customer=${req.body.customer} and id=${req.body.user}`;
      else sql = `select id,customer,name from ${tableName} where customer=${req.body.customer}`;
      req.dbCon.query(
        sql,
        (
          error: Error,
          result: Array<{
            id: number;
            customer: number;
            name: string;
            email: string;
            username: string;
            enabled: number;
            role: number;
            allowed_from: string;
            last_login: Date;
          }>,
        ) => {
          if (error) return reject(error);
          resolve(result);
        },
      );
    });
  }

  public static _delete(req): Promise<void> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(`delete from user__fwcloud where user=${req.body.user}`, (error) => {
        if (error) return reject(error);

        req.dbCon.query(
          `delete from ${tableName} where customer=${req.body.customer} and id=${req.body.user}`,
          (error: Error) => {
            if (error) return reject(error);
            resolve();
          },
        );
      });
    });
  }

  public static lastAdminUser(
    req,
  ): Promise<{ result: boolean; restrictions?: { LastAdminUser: boolean } }> {
    return new Promise((resolve, reject) => {
      req.dbCon.query(
        `select count(*) as n from ${tableName} where role=1`,
        async (error: Error, result: Array<{ n: number }>) => {
          if (error) return reject(error);

          if (result[0].n < 2) resolve({ result: true, restrictions: { LastAdminUser: true } });
          else resolve({ result: false });
        },
      );
    });
  }

  public static allowFwcloudAccess(dbCon: Query, user: number, fwcloud: number) {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `INSERT IGNORE user__fwcloud values(${user},${fwcloud})`,
        (error: Error, result: { insertId: number }) => {
          if (error) return reject(error);
          resolve(result.insertId);
        },
      );
    });
  }

  public static allowAllFwcloudAccess(dbCon: Query, user: number): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(`select id from fwcloud`, async (error: Error, result: Array<{ id: number }>) => {
        if (error) return reject(error);

        try {
          for (const fwcloud of result) {
            await this.allowFwcloudAccess(dbCon, user, fwcloud.id);
          }

          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public static disableFwcloudAccess(dbCon: Query, user: number, fwcloud: number): Promise<void> {
    return new Promise((resolve, reject) => {
      dbCon.query(
        `delete from user__fwcloud where user=${user} and fwcloud=${fwcloud}`,
        (error: Error) => {
          if (error) return reject(error);
          resolve();
        },
      );
    });
  }
}
