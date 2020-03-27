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
import { PrimaryGeneratedColumn, Column, Entity, ManyToOne, JoinColumn, OneToMany } from "typeorm";
import { CaPrefix } from "./CaPrefix";
import { FwCloud } from "../../fwcloud/FwCloud";
import { User } from "../../user/User";
import { Crt } from "./Crt";
var config = require('../../../config/config');
const fwcError = require('../../../utils/error_table');
const spawn = require('child-process-promise').spawn;
const readline = require('readline');
const fs = require('fs');

const tableName: string = 'ca';

@Entity(tableName)
export class Ca extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    cn: string;

    @Column({
        unsigned: true
    })
    days: number;

    @Column()
    comment: string;

    @Column()
    status: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @ManyToOne(type => User, user => user.created_cas)
    @JoinColumn({
        name: 'created_by'
    })
    created_by: User;

    @ManyToOne(type => User, user => user.updated_cas)
    @JoinColumn({
        name: 'updated_by'
    })
    updated_by: User;

    @Column({name: 'fwcloud'})
    fwCloudId: number;

    @ManyToOne(type => FwCloud, fwcloud => fwcloud.cas)
    @JoinColumn({
        name: 'fwcloud'
    })
    fwCloud: FwCloud;

    @OneToMany(type => Crt, crt => crt.ca)
    crts: Array<Crt>

    @OneToMany(type => CaPrefix, caPrefix => caPrefix.ca)
    prefixes: Array<CaPrefix>

    public getTableName(): string {
        return tableName;
    }

    // Insert new CA in the database.
    public static createCA(req) {
        return new Promise((resolve, reject) => {
            const ca = {
                fwcloud: req.body.fwcloud,
                cn: req.body.cn,
                days: req.body.days,
                comment: req.body.comment,
                status: 1 // This status variable will be changed to 0 when the DF file generation is completed.
            }
            req.dbCon.query('insert into ca SET ?', ca, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    };

    // Delete CA.
    public static deleteCA(req) {
        return new Promise((resolve, reject) => {
            // Verify that the CA can be deleted.
            req.dbCon.query('SELECT count(*) AS n FROM crt WHERE ca=' + req.body.ca, (error, result) => {
                if (error) return reject(error);
                if (result[0].n > 0) return reject(fwcError.other('This CA can not be removed because it still has certificates'));

                req.dbCon.query('DELETE FROM ca WHERE id=' + req.body.ca, (error, result) => {
                    if (error) return reject(error);
                    resolve();
                });
            });
        });
    };



    // Get CA list for a fwcloud.
    public static getCAlist(dbCon, fwcloud) {
        return new Promise((resolve, reject) => {
            dbCon.query(`SELECT * FROM ca WHERE fwcloud=${fwcloud}`, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    };

    /** 
     * Store the CA and cert ids into the tree's nodes used for the OpenVPN configurations.
     */
    public static storePkiInfo(req, tree) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT VPN.id as openvpn,VPN.openvpn as openvpn_parent,CRT.id as crt,CRT.ca FROM crt CRT
      INNER JOIN openvpn VPN on VPN.crt=CRT.id
      INNER JOIN firewall FW ON FW.id=VPN.firewall
      WHERE FW.fwcloud=${req.body.fwcloud}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                tree.openvpn_info = result;
                resolve();
            });
        });
    };

    // Execute EASY-RSA command.
    public static runEasyRsaCmd(req, easyrsaDataCmd) {
        return new Promise((resolve, reject) => {
            const pki_dir = '--pki-dir=' + config.get('pki').data_dir + '/' + req.body.fwcloud + '/' + req.caId;
            var argv = ['--batch', pki_dir];

            switch (easyrsaDataCmd) {
                case 'init-pki':
                case 'gen-crl':
                case 'gen-dh':
                    argv.push(easyrsaDataCmd);
                    break;

                case 'build-ca':
                    argv.push('--days=' + req.body.days);
                    argv.push('--req-cn=' + req.body.cn);
                    argv.push(easyrsaDataCmd);
                    if (!req.body.pass)
                        argv.push('nopass');
                    break;

                case 'build-server-full':
                case 'build-client-full':
                    argv.push('--days=' + req.body.days);
                    argv.push(easyrsaDataCmd);
                    argv.push(req.body.cn);
                    if (!req.body.pass)
                        argv.push('nopass');
                    break;
            }
            const promise = spawn(config.get('pki').easy_rsa_cmd, argv);
            //const childProcess = promise.childProcess;

            //if (!req.body.pass)
            //  childProcess.stdin.push('mipass');

            //childProcess.stdout.on('data', data => console.log('stdout: ', data.toString()) );
            //childProcess.stderr.on('data', data => console.log('stderr: ', data.toString()) );
            //childProcess.stdin.push('TEST');

            promise.then(result => resolve(result))
                .catch(error => reject(error));
        });
    };

    // Get certificate serial number.
    public static delFromIndex(dir, cn) {
        return new Promise((resolve, reject) => {
            var serial = '';
            const substr = 'CN=' + cn + '\n';
            const src_path = dir + '/index.txt';
            const dst_path = dir + '/index.txt.TMP';
            var rs = fs.createReadStream(src_path);
            var ws = fs.createWriteStream(dst_path);

            rs.on('error', error => reject(error));
            ws.on('error', error => reject(error));

            const rl = readline.createInterface({
                input: rs,
                crlfDelay: Infinity
            });

            rl.on('line', line => {
                const line2 = line + '\n';
                if (line2.indexOf(substr) > -1) {
                    serial = line.split('\t')[3];
                } else ws.write(line2);
            });

            rl.on('close', () => {
                ws.close();
                fs.unlink(src_path, error => {
                    if (error) return reject(error);
                    fs.rename(dst_path, src_path, error => {
                        if (error) return reject(error);
                        resolve(serial);
                    });
                });
            });
        });
    };

    // Get the ID of all CA who's status field is not zero.
    public static getCAStatusNotZero(req, data) {
        return new Promise((resolve, reject) => {
            req.dbCon.query(`SELECT id,status FROM ca WHERE status!=0 AND fwcloud=${req.body.fwcloud}`, (error, rows) => {
                if (error) return reject(error);
                data.ca_status = rows;
                resolve(data);
            });
        });
    };


    public static searchCAHasCRTs(dbCon, fwcloud, ca) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT CRT.id FROM crt CRT
      INNER JOIN ca CA ON CA.id=CRT.ca
      WHERE CA.fwcloud=${fwcloud} AND CA.id=${ca}`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);

                if (result.length > 0)
                    resolve({ result: true, restrictions: { caHasCertificates: true } });
                else
                    resolve({ result: false });
            });
        });
    };

    public static searchCAHasPrefixes(dbCon, fwcloud, ca) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT P.id FROM ca_prefix P
      INNER JOIN ca CA ON CA.id=P.ca
      WHERE CA.fwcloud=${fwcloud} AND CA.id=${ca}`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);

                if (result.length > 0)
                    resolve({ result: true, restrictions: { caHasPrefixes: true } });
                else
                    resolve({ result: false });
            });
        });
    };

}