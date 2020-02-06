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

import db from '../../database/DatabaseService';
import Model from '../Model';
const fwcError = require('../../utils/error_table');

var bcrypt = require('bcrypt');

const tableName: string = "user";

export class User extends Model {

    public getTableName(): string {
        return tableName;
    }

    //Get user by  username
    public static getUserName = function (customer, username) {
        return new Promise((resolve, reject) => {
            db.get(function (error, connection) {
                if (error) return reject(error);

                var sql = 'SELECT * FROM user ' +
                    'WHERE customer=' + connection.escape(customer) + ' AND username =' + connection.escape(username);

                connection.query(sql, function (error, row) {
                    if (error)
                        reject(error);
                    else
                        resolve(row);
                });
            });
        });
    }


    public static getAllAdminUserIds(req) {
        return new Promise((resolve, reject) => {
            req.dbCon.query(`select id from ${tableName} where role=1`, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    }



    //Update user confirmation_token
    public static updateUserCT = function (iduser, token, callback) {
        return new Promise((resolve, reject) => {
            db.get(function (error, connection) {
                if (error)
                    reject(error);
                var sql = 'UPDATE user SET ' +
                    ' confirmation_token =  ' + connection.escape(token) +
                    ' WHERE id = ' + connection.escape(iduser);
                connection.query(sql, function (error, result) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(true);
                    }
                });
            });
        });
    }



    //Add new customer
    public static insert(req) {
        return new Promise(async (resolve, reject) => {
            //New object with customer data
            var salt = bcrypt.genSaltSync(10);
            var userData = {
                id: null,
                customer: req.body.customer,
                name: req.body.name,
                email: req.body.email,
                username: req.body.username,
                password: bcrypt.hashSync(req.body.customer + req.body.username + req.body.password, salt),
                enabled: req.body.enabled,
                role: req.body.role,
                allowed_from: req.body.allowed_from
            };

            req.dbCon.query(`INSERT INTO ${tableName} SET ?`, userData, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    }


    public static existsCustomerUserName(dbCon, customer, username) {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`select id from ${tableName} where customer=${customer} and username=${dbCon.escape(username)}`, (error, result) => {
                if (error) return reject(error);
                if (result.length > 0) return resolve(true);
                resolve(false);
            });
        });
    }

    public static existsCustomerUserNameOtherId(dbCon, customer, username, user) {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`select id from ${tableName} where customer=${customer} and username=${dbCon.escape(username)} and id!=${user}`, (error, result) => {
                if (error) return reject(error);
                if (result.length > 0) return resolve(true);
                resolve(false);
            });
        });
    }


    public static existsCustomerUserId(dbCon, customer, user) {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`select id from ${tableName} where customer=${customer} and id=${user}`, (error, result) => {
                if (error) return reject(error);
                if (result.length > 0) return resolve(true);
                resolve(false);
            });
        });
    }

    public static isAdmin(req) {
        return new Promise(async (resolve, reject) => {
            req.dbCon.query(`select role from ${tableName} where customer=${req.body.customer} and id=${req.body.user}`, (error, result) => {
                if (error) return reject(error);
                if (result.length === 0) return reject(fwcError.NOT_FOUND);

                resolve(result[0].role === 1 ? true : false);
            });
        });
    }

    public static isLoggedUserAdmin(req) {
        return new Promise(async (resolve, reject) => {
            req.dbCon.query(`select role from ${tableName} where id=${req.session.user_id}`, (error, result) => {
                if (error) return reject(error);
                if (result.length === 0) return reject(fwcError.NOT_FOUND);

                resolve(result[0].role === 1 ? true : false);
            });
        });
    }


    public static update(req) {
        return new Promise(async (resolve, reject) => {
            let crypt_pass = '';
            if (req.body.password) {
                var salt = bcrypt.genSaltSync(10);
                crypt_pass = bcrypt.hashSync(req.body.customer + req.body.username + req.body.password, salt);
            }

            let sql = `UPDATE ${tableName} SET customer=${req.body.customer},
                name=${req.dbCon.escape(req.body.name)},
                email=${req.dbCon.escape(req.body.email)},
                username=${req.dbCon.escape(req.body.username)},
                ${(crypt_pass) ? `password=${req.dbCon.escape(crypt_pass)},` : ``}
                enabled=${req.body.enabled},
                role=${req.body.role},
                allowed_from=${req.dbCon.escape(req.body.allowed_from)}
                WHERE id=${req.body.user}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }

    public static changeLoggedUserPass(req) {
        return new Promise(async (resolve, reject) => {
            var salt = bcrypt.genSaltSync(10);
            const crypt_pass = bcrypt.hashSync(req.session.customer_id + req.session.username + req.body.password, salt);

            req.dbCon.query(`UPDATE ${tableName} SET password=${req.dbCon.escape(crypt_pass)} WHERE id=${req.session.user_id}`, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }


    public static get(req) {
        return new Promise(async (resolve, reject) => {
            let sql = '';

            if (req.body.user)
                sql = `select id,customer,name,email,username,enabled,role,allowed_from,last_login from ${tableName} where customer=${req.body.customer} and id=${req.body.user}`;
            else
                sql = `select id,customer,name from ${tableName} where customer=${req.body.customer}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    }


    public static delete(req) {
        return new Promise(async (resolve, reject) => {
            req.dbCon.query(`delete from user__fwcloud where user=${req.body.user}`, (error, result) => {
                if (error) return reject(error);

                req.dbCon.query(`delete from ${tableName} where customer=${req.body.customer} and id=${req.body.user}`, (error, result) => {
                    if (error) return reject(error);
                    resolve();
                });
            });
        });
    }


    public static lastAdminUser(req) {
        return new Promise((resolve, reject) => {
            req.dbCon.query(`select count(*) as n from ${tableName} where role=1`, async (error, result) => {
                if (error) return reject(error);

                if (result[0].n < 2)
                    resolve({ result: true, restrictions: { LastAdminUser: true } });
                else
                    resolve({ result: false });
            });
        });
    }


    public static allowFwcloudAccess(dbCon, user, fwcloud) {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`INSERT IGNORE user__fwcloud values(${user},${fwcloud})`, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    }

    public static allowAllFwcloudAccess(dbCon, user) {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`select id from fwcloud`, async (error, result) => {
                if (error) return reject(error);

                try {
                    for (let fwcloud of result) {
                        await this.allowFwcloudAccess(dbCon, user, fwcloud.id);
                    }

                    resolve();
                } catch (error) { reject(error) }
            });
        });
    }

    public static disableFwcloudAccess(dbCon, user, fwcloud) {
        return new Promise(async (resolve, reject) => {
            dbCon.query(`delete from user__fwcloud where user=${user} and fwcloud=${fwcloud}`, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }

}