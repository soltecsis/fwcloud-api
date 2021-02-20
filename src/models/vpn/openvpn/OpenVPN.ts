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
import { Firewall } from '../../../models/firewall/Firewall';
import { PolicyRuleToOpenVPN } from '../../../models/policy/PolicyRuleToOpenVPN';
import { Interface } from '../../../models/interface/Interface';
import { PrimaryGeneratedColumn, Column, Entity, OneToOne, ManyToOne, JoinColumn, OneToMany, ManyToMany, JoinTable } from "typeorm";
const config = require('../../../config/config');
import { IPObj } from '../../ipobj/IPObj';
const readline = require('readline');
import { Tree } from '../../../models/tree/Tree';
import { Crt } from "../pki/Crt";
import { OpenVPNOption } from "./openvpn-option.model";
import { IPObjGroup } from "../../ipobj/IPObjGroup";
import sshTools from '../../../utils/ssh';
import { OpenVPNPrefix } from "./OpenVPNPrefix";
import { ProgressInfoPayload, ProgressErrorPayload, ProgressNoticePayload, ProgressWarningPayload } from "../../../sockets/messages/socket-message";
import { Channel } from "../../../sockets/channels/channel";
import { EventEmitter } from "events";
const fwcError = require('../../../utils/error_table');
const fs = require('fs');
const ip = require('ip');

const tableName: string = 'openvpn';

@Entity(tableName)
export class OpenVPN extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    install_dir: string;

    @Column()
    install_name: string;

    @Column()
    comment: string;

    @Column()
    status: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @Column()
    installed_at: Date;

    @Column({name: 'openvpn'})
    parentId: number;

    @ManyToOne(type => OpenVPN, openVPN => openVPN.childs)
    @JoinColumn({
        name: 'openvpn'
    })
    parent: OpenVPN

    @OneToMany(type => OpenVPN, openVPN => openVPN.parent)
    childs: Array<OpenVPN>

    @Column({name: 'firewall'})
    firewallId: number;

    @ManyToOne(type => Firewall, firewall => firewall.openVPNs)
    @JoinColumn({
        name: 'firewall'
    })
    firewall: Firewall;

    @Column({name: 'crt'})
    crtId: number;

    @ManyToOne(type => Crt, crt => crt.openVPNs)
    @JoinColumn({
        name: 'crt'
    })
    crt: Crt;

    @OneToMany(type => OpenVPNOption, options => options.openVPN)
    openVPNOptions: Array<OpenVPNOption>

    @ManyToMany(type => IPObjGroup, ipObjGroup => ipObjGroup.openVPNs)
    @JoinTable({
        name: 'openvpn__ipobj_g',
        joinColumn: {
            name: 'openvpn'
        },
        inverseJoinColumn: {
            name: 'ipobj_g'
        }
    })
    ipObjGroups: Array<IPObjGroup>;

    @OneToMany(type => PolicyRuleToOpenVPN, policyRuleToOpenVPN => policyRuleToOpenVPN.openVPN)
    policyRuleToOpenVPNs: Array<PolicyRuleToOpenVPN>;

    @OneToMany(type => OpenVPNPrefix, model => model.openVPN)
    openVPNPrefixes: Array<OpenVPNPrefix>;


    public getTableName(): string {
        return tableName;
    }

    // Insert new OpenVPN configuration register in the database.
    public static addCfg(req) {
        return new Promise((resolve, reject) => {
            const cfg = {
                openvpn: req.body.openvpn,
                firewall: req.body.firewall,
                crt: req.body.crt,
                install_dir: req.body.install_dir,
                install_name: req.body.install_name,
                comment: req.body.comment,
                status: 1
            }
            req.dbCon.query(`insert into ${tableName} SET ?`, cfg, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    };

    public static updateCfg(req) {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE ${tableName} SET install_dir=${req.dbCon.escape(req.body.install_dir)},
      install_name=${req.dbCon.escape(req.body.install_name)},
      comment=${req.dbCon.escape(req.body.comment)}
      WHERE id=${req.body.openvpn}`
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    public static addCfgOpt(req, opt) {
        return new Promise((resolve, reject) => {
            req.dbCon.query('insert into openvpn_opt SET ?', opt, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    public static delCfgOptAll(req) {
        return new Promise((resolve, reject) => {
            let sql = 'delete from openvpn_opt where openvpn=' + req.body.openvpn;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    public static delCfg(dbCon, fwcloud, openvpn) {
        return new Promise((resolve, reject) => {
            // Get all the ipobj referenced by this OpenVPN configuration.
            let sql = `select OBJ.id,OBJ.type from openvpn_opt OPT
      inner join ipobj OBJ on OBJ.id=OPT.ipobj
      where OPT.openvpn=${openvpn} and OPT.name!='remote'`;
            dbCon.query(sql, (error, ipobj_list) => {
                if (error) return reject(error);

                dbCon.query(`delete from openvpn_opt where openvpn=${openvpn}`, (error, result) => {
                    if (error) return reject(error);

                    dbCon.query(`delete from openvpn_prefix where openvpn=${openvpn}`, (error, result) => {
                        if (error) return reject(error);

                        dbCon.query(`delete from ${tableName} where id=${openvpn}`, async (error, result) => {
                            if (error) return reject(error);

                            // Remove all the ipobj referenced by this OpenVPN configuration.
                            // In the restrictions check we have already checked that it is possible to remove them.
                            try {
                                for (let ipobj of ipobj_list) {
                                    await IPObj.deleteIpobj(dbCon, fwcloud, ipobj.id);
                                    await Tree.deleteObjFromTree(fwcloud, ipobj.id, ipobj.type);
                                }
                            } catch (error) { return reject(error) }

                            resolve();
                        });
                    });
                });
            });
        });
    };

    public static delCfgAll(dbCon, fwcloud, firewall) {
        return new Promise((resolve, reject) => {
            // Remove all the ipobj referenced by this OpenVPN configuration.
            // In the restrictions check we have already checked that it is possible to remove them.
            // IMPORTANT: Order by CRT type for remove clients before servers. If we don't do it this way, 
            // and the OpenVPN server is removed first, we will get a database foreign key constraint fails error.
            let sql = `select VPN.id,CRT.type from ${tableName} VPN
      inner join crt CRT on CRT.id=VPN.crt
      where VPN.firewall=${firewall} order by CRT.type asc`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);

                try {
                    for (let openvpn of result) {
                        await this.delCfg(dbCon, fwcloud, openvpn.id);
                    }
                } catch (error) { return reject(error) }

                resolve();
            });
        });
    };

    public static getCfgId(req) {
        return new Promise((resolve, reject) => {
            let sql = `select id from ${tableName} where firewall=${req.body.firewall} and crt=${req.body.crt}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result[0].id);
            });
        });
    };

    public static getCfg(req) {
        return new Promise((resolve, reject) => {
            let sql = `select * from ${tableName} where id=${req.body.openvpn}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);

                let data = result[0];
                sql = 'select * from openvpn_opt where openvpn=' + req.body.openvpn;
                req.dbCon.query(sql, (error, result) => {
                    if (error) return reject(error);

                    data.options = result;
                    resolve(data);
                });
            });
        });
    };

    public static getOptData(dbCon, openvpn, name) {
        return new Promise((resolve, reject) => {
            let sql = 'select * from openvpn_opt where openvpn=' + openvpn + ' and name=' + dbCon.escape(name);
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result.length === 0 ? null : result[0]);
            });
        });
    };

    // Get certificate data form file.
    public static getCRTData(file) {
        return new Promise((resolve, reject) => {
            var data = '';
            var onData = 0;
            var rs = fs.createReadStream(file);

            rs.on('error', error => reject(error));

            const rl = readline.createInterface({
                input: rs,
                crlfDelay: Infinity
            });

            rl.on('line', line => {
                if (onData)
                    data += line + '\n';
                else if (line.indexOf('-----BEGIN ') === 0) {
                    data += line + '\n';
                    onData = 1;
                }
            });

            rl.on('close', () => { resolve(data) });
        });
    };

    // Get data of an OpenVPN server clients.
    public static getOpenvpnClients(dbCon, openvpn) {
        return new Promise((resolve, reject) => {
            let sql = `select VPN.id,CRT.cn from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      where openvpn=${openvpn}`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    };


    // Get data of OpenVPN servers of a firewall.
    public static getOpenvpnServersByFirewall(dbCon, firewall) {
        return new Promise((resolve, reject) => {
            let sql = `select VPN.id,CRT.cn from openvpn VPN 
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.firewall=${firewall} and CRT.type=2`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    };
    
    // Get OpenVPN client configuration data.
    public static getOpenvpnInfo(dbCon, fwcloud, openvpn, type) {
        return new Promise((resolve, reject) => {
            let sql = `select VPN.*, FW.fwcloud, FW.id firewall_id, FW.name firewall_name, CRT.cn, CA.cn as CA_cn, O.address, FW.cluster cluster_id,
      IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name,
      IF(VPN.openvpn is null,VPN.openvpn,(select crt.cn from openvpn inner join crt on crt.id=openvpn.crt where openvpn.id=VPN.openvpn)) as openvpn_server_cn
      ${(type === 2) ? `,O.netmask` : ``}, ${(type === 1) ? `311` : `312`} as type
      from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      inner join firewall FW on FW.id=VPN.firewall
      inner join openvpn_opt OPT on OPT.openvpn=${openvpn}
      inner join ipobj O on O.id=OPT.ipobj
      where FW.fwcloud=${fwcloud} and VPN.id=${openvpn} ${(type === 1) ? `and OPT.name='ifconfig-push'` : ``}`;
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    };

    public static getOpenvpnServersByCloud(dbCon, fwcloud) {
        return new Promise((resolve, reject) => {
            let sql = `select VPN.id,CRT.cn from openvpn VPN 
      inner join crt CRT on CRT.id=VPN.crt
      inner join ca CA on CA.id=CRT.ca
      where CA.fwcloud=${fwcloud} and CRT.type=2`; // 2 = Server certificate.
            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    };

    public static dumpCfg(dbCon, fwcloud, openvpn) {
        return new Promise((resolve, reject) => {
            // First obtain the CN of the certificate.
            let sql = `select CRT.cn, CRT.ca, CRT.type, FW.name as fw_name, CL.name as cl_name,
                VPN.install_name as srv_config1, VPNSRV.install_name as srv_config2 from crt CRT
                INNER JOIN openvpn VPN ON VPN.crt=CRT.id
                LEFT JOIN openvpn VPNSRV ON VPNSRV.id=VPN.openvpn
                INNER JOIN firewall FW ON FW.id=VPN.firewall
                LEFT JOIN cluster CL ON CL.id=FW.cluster
			    WHERE VPN.id=${openvpn}`;

            dbCon.query(sql, (error, result) => {
                if (error) return reject(error);

                const ca_dir = config.get('pki').data_dir + '/' + fwcloud + '/' + result[0].ca + '/';
                const ca_crt_path = ca_dir + 'ca.crt';
                const crt_path = ca_dir + 'issued/' + result[0].cn + '.crt';
                const key_path = ca_dir + 'private/' + result[0].cn + '.key';
                let dh_path = (result[0].type === 2) ? ca_dir + 'dh.pem' : '';

                // Header description.
                let des = "# FWCloud.net - Developed by SOLTECSIS (https://soltecsis.com)\n" 
                des += `# Generated: ${Date()}\n`;
                des += `# Certificate Common Name: ${result[0].cn} \n`;
                des += result[0].cl_name ? `# Firewall Cluster: ${result[0].cl_name}\n` : `# Firewall: ${result[0].fw_name}\n`;
                if (result[0].srv_config1 && result[0].srv_config1.endsWith('.conf')) result[0].srv_config1 = result[0].srv_config1.slice(0, -5);
                if (result[0].srv_config2 && result[0].srv_config2.endsWith('.conf')) result[0].srv_config2 = result[0].srv_config2.slice(0, -5);
                des += `# OpenVPN Server: ${result[0].srv_config1 ? result[0].srv_config1 : result[0].srv_config2}\n`;
                des += `# Type: ${result[0].srv_config1 ? 'Server' : 'Client'}\n\n`;

                // Get all the configuration options.
                sql = `select name,ipobj,arg,scope,comment from openvpn_opt where openvpn=${openvpn} order by openvpn_opt.order`;
                dbCon.query(sql, async (error, result) => {
                    if (error) return reject(error);

                    try {
                        // Generate the OpenVPN config file.
                        let ovpn_cfg = des;
                        let ovpn_ccd = '';

                        // First add all the configuration options.
                        for (let opt of result) {
                            let cfg_line = ((opt.comment) ? '# ' + opt.comment.replace('\n', '\n# ') + '\n' : '') + opt.name;
                            if (opt.ipobj) {
                                // Get the ipobj data.
                                const ipobj: any = await IPObj.getIpobjInfo(dbCon, fwcloud, opt.ipobj);
                                if (ipobj.type === 7) { // Network
                                    const netmask = (ipobj.netmask[0]==='/') ? ip.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask : ipobj.netmask;
                                    cfg_line += ' ' + ipobj.address + ' ' + netmask;
                                }
                                else if (ipobj.type === 5) { // Address
                                    cfg_line += ' ' + ipobj.address;
                                    if (opt.name === 'ifconfig-push')
                                        cfg_line += ' ' + ipobj.netmask;
                                    else if (opt.name === 'remote')
                                        cfg_line += ' ' + opt.arg;
                                }
                                else if (ipobj.type === 9) { // DNS Name
                                    cfg_line += ' ' + ipobj.name;
                                    if (opt.name === 'remote')
                                        cfg_line += ' ' + opt.arg;
                                }
                            }
                            else if (opt.arg)
                                cfg_line += ' ' + opt.arg;

                            if (opt.scope === 0) // CCD file
                                ovpn_ccd += cfg_line + '\n';
                            else // Config file
                                ovpn_cfg += cfg_line + '\n';
                        }

                        // Now read the files data and put it into de config files.
                        if (dh_path) // Configuración OpenVPN de servidor.
                            ovpn_cfg += '\n<dh>\n' + (await this.getCRTData(dh_path)) + "</dh>\n";
                        ovpn_cfg += '\n<ca>\n' + (await this.getCRTData(ca_crt_path)) + "</ca>\n";
                        ovpn_cfg += '\n<cert>\n' + (await this.getCRTData(crt_path)) + "</cert>\n";
                        ovpn_cfg += '\n<key>\n' + (await this.getCRTData(key_path)) + "</key>\n";

                        resolve({ cfg: ovpn_cfg, ccd: ovpn_ccd });
                    } catch (error) { reject(error) }
                });
            });
        });
    };


    public static installCfg(req, cfg, dir, name, type, channel: EventEmitter = new EventEmitter()) {
        return new Promise(async (resolve, reject) => {
            try {
                const fwData: any = await Firewall.getFirewallSSH(req);

                if (type === 1) { 
                    // Client certificarte
                    channel.emit('message', new ProgressInfoPayload(`Uploading CCD configuration file '${dir}/${name}' to: (${fwData.SSHconn.host})\n`));
                } else {
                    channel.emit('message', new ProgressNoticePayload(`Uploading OpenVPN configuration file '${dir}/${name}' to: (${fwData.SSHconn.host})\n`));
                }
                
                await sshTools.uploadStringToFile(fwData.SSHconn, cfg, name);

                const sudo = fwData.SSHconn.username === 'root' ? '' : 'sudo';

                const existsDir = await sshTools.runCommand(fwData.SSHconn, `if [ -d "${dir}" ]; then echo -n 1; else echo -n 0; fi`);
                if (existsDir === "0") {
                    channel.emit('message', new ProgressNoticePayload(`Creating install directory.\n`));
                    await sshTools.runCommand(fwData.SSHconn, `${sudo} mkdir "${dir}"`);
                    await sshTools.runCommand(fwData.SSHconn, `${sudo} chown root:root "${dir}"`);
                    await sshTools.runCommand(fwData.SSHconn, `${sudo} chmod 755 "${dir}"`);
                }

                channel.emit('message', new ProgressNoticePayload(`Installing OpenVPN configuration file.\n`));
                await sshTools.runCommand(fwData.SSHconn, `${sudo} mv ${name} ${dir}/`);

                channel.emit('message', new ProgressNoticePayload(`Setting up file permissions.\n\n`));
                await sshTools.runCommand(fwData.SSHconn, `${sudo} chown root:root ${dir}/${name}`);

                if (type === 1) { 
                    // Client certificate.
                    await sshTools.runCommand(fwData.SSHconn, `${sudo} chmod 644 ${dir}/${name}`);
                } else {
                    // Server certificate.
                    await sshTools.runCommand(fwData.SSHconn, `${sudo} chmod 600 ${dir}/${name}`);
                }

                resolve();
            } catch (error) {
                channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
                reject(error);
            }
        });
    };

    public static uninstallCfg(req, dir, name, channel: EventEmitter = new EventEmitter()) {
        return new Promise(async (resolve, reject) => {
            try {
                const fwData: any = await Firewall.getFirewallSSH(req);

                channel.emit('message', new ProgressNoticePayload(`Removing OpenVPN configuration file '${dir}/${name}' from: (${fwData.SSHconn.host})\n`));
                const sudo = fwData.SSHconn.username === 'root' ? '' : 'sudo';
                await sshTools.runCommand(fwData.SSHconn, `${sudo} rm -f "${dir}/${name}"`);

                resolve();
            } catch (error) {
                channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
                reject(error);
            }
        });
    };

    public static ccdCompare(req, dir, clients, channel: EventEmitter = new EventEmitter()) {
        return new Promise(async (resolve, reject) => {
            try {
                const fwData: any = await Firewall.getFirewallSSH(req);

                channel.emit('message', new ProgressInfoPayload(`Comparing files with OpenVPN client configurations.\n`));
                const fileList = (await sshTools.runCommand(fwData.SSHconn, `cd ${dir}; ls -p | grep -v "/$"`)).trim().split('\r\n');
                let found;
                let notFoundList = "";
                for (let file of fileList) {
                    found = 0;
                    for (let client of clients) {
                        if (client.cn === file) {
                            found = 1;
                            break;
                        }
                    }
                    if (!found) notFoundList += `${file}\n`;
                }

                if (notFoundList) {
                    channel.emit('message', new ProgressWarningPayload(`Found files in the directory '${dir}' without OpenVPN config:
                        ${notFoundList}
                        `));
                }
                else {
                    channel.emit('message', new ProgressInfoPayload(`Ok.\n\n`));
                }

                resolve(notFoundList);
            } catch (error) {
                channel.emit('message', new ProgressErrorPayload(`ERROR: ${error}\n`));
                reject(error);
            }
        });
    };


    public static updateOpenvpnStatus(dbCon, openvpn, status_action) {
        return new Promise((resolve, reject) => {
            dbCon.query(`UPDATE openvpn SET status=status${status_action} WHERE id=${openvpn}`, (error, result) => {
                if (error) return reject(error);
                resolve({ "result": true });
            });
        });
    };

    public static updateOpenvpnInstallDate(dbCon, openvpn) {
        return new Promise((resolve, reject) => {
            dbCon.query(`UPDATE openvpn SET installed_at=NOW() WHERE id=${openvpn}`, (error, result) => {
                if (error) return reject(error);
                resolve({ "result": true });
            });
        });
    };

    public static updateOpenvpnStatusIPOBJ(req, ipobj, status_action) {
        return new Promise((resolve, reject) => {
            var sql = `UPDATE openvpn VPN
      INNER JOIN openvpn_opt OPT ON OPT.openvpn=VPN.id
      INNER JOIN ipobj O ON O.id=OPT.ipobj
      SET VPN.status=VPN.status${status_action}
      WHERE O.fwcloud=${req.body.fwcloud} AND O.id=${ipobj}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    public static freeVpnIP(req) {
        return new Promise((resolve, reject) => {
            // Search for the VPN LAN and mask.
            let sql = `select OBJ.address,OBJ.netmask from openvpn_opt OPT
                inner join ipobj OBJ on OBJ.id=OPT.ipobj
                where OPT.openvpn=${req.body.openvpn} and OPT.name='server' and OPT.ipobj is not null`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);

                // If we have no VPN LAN we can not give any free IP.
                if (result.length === 0) return reject(fwcError.other('OpenVPN LAN not found'));

                // net will contain information about the VPN network.
                const ipobj = result[0];
                const netmask = (ipobj.netmask[0]==='/') ? ip.cidrSubnet(`${ipobj.address}${ipobj.netmask}`).subnetMask : ipobj.netmask;
                const net = ip.subnet(ipobj.address, netmask);
                net.firstLong = ip.toLong(net.firstAddress) + 1; // The first usable IP is for the OpenVPN server.
                net.lastLong = ip.toLong(net.lastAddress);

                // Obtain the VPN LAN used IPs.
                sql = `select OBJ.address from openvpn VPN
                    inner join openvpn_opt OPT on OPT.openvpn=VPN.id
                    inner join ipobj OBJ on OBJ.id=OPT.ipobj
                    where VPN.openvpn=${req.body.openvpn} and OPT.ipobj is not null and OBJ.type=5`; // 5=ADDRESS
                req.dbCon.query(sql, (error, result) => {
                    if (error) return reject(error);

                    let freeIPLong;
                    let found;
                    for (freeIPLong = net.firstLong; freeIPLong <= net.lastLong; freeIPLong++) {
                        found = 0;
                        for (let ipCli of result) {
                            if (freeIPLong === ip.toLong(ipCli.address)) {
                                found = 1;
                                break;
                            }
                        }
                        if (!found)
                            return resolve({ 'ip': ip.fromLong(freeIPLong), 'netmask': netmask });
                    }
                    reject(fwcError.other('There are no free VPN IPs'));
                });
            });
        });
    };

    public static searchOpenvpnUsage(dbCon, fwcloud, openvpn) {
        return new Promise(async (resolve, reject) => {
            try {
                let search: any = {};
                search.result = false;
                search.restrictions = {};

                /* Verify that the OpenVPN configuration is not used in any
                    - Rule (table policy_r__openvpn)
                    - IPBOJ group.
                    - OpenVPN is the last in a CRT prefix used in a rule or group.
                */
                search.restrictions.OpenvpnInRule = await PolicyRuleToOpenVPN.searchOpenvpnInRule(dbCon, fwcloud, openvpn);
                search.restrictions.OpenvpnInGroup = await PolicyRuleToOpenVPN.searchOpenvpnInGroup(dbCon, fwcloud, openvpn);
                search.restrictions.LastOpenvpnInPrefixInRule = await PolicyRuleToOpenVPN.searchLastOpenvpnInPrefixInRule(dbCon, fwcloud, openvpn);
                search.restrictions.LastOpenvpnInPrefixInGroup = await PolicyRuleToOpenVPN.searchLastOpenvpnInPrefixInGroup(dbCon, fwcloud, openvpn);

                for (let key in search.restrictions) {
                    if (search.restrictions[key].length > 0) {
                        search.result = true;
                        break;
                    }
                }
                resolve(search);
            } catch (error) { reject(error) }
        });
    };

    public static searchOpenvpnUsageOutOfThisFirewall(req) {
        return new Promise((resolve, reject) => {
            // First get all firewalls OpenVPN configurations.
            let sql = 'select id from openvpn where firewall=' + req.body.firewall;

            req.dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);

                let answer: any = {};
                answer.restrictions = {};
                answer.restrictions.OpenvpnInRule = [];
                answer.restrictions.OpenvpnInGroup = [];

                try {
                    for (let openvpn of result) {
                        const data: any = await this.searchOpenvpnUsage(req.dbCon, req.body.fwcloud, openvpn.id);
                        if (data.result) {
                            // OpenVPN config found in rules of other firewall.
                            if (data.restrictions.OpenvpnInRule.length > 0) {
                                for (let rule of data.restrictions.OpenvpnInRule) {
                                    if (rule.firewall_id != req.body.firewall)
                                        answer.restrictions.OpenvpnInRule.push(rule);
                                }
                            }

                            // OpenVPN config found in a group.
                            if (data.restrictions.OpenvpnInGroup.length > 0)
                                answer.restrictions.OpenvpnInGroup = answer.restrictions.OpenvpnInGroup.concat(data.restrictions.OpenvpnInGroup);
                        }
                    }
                } catch (error) { reject(error) }

                resolve(answer);
            });
        });
    };


    public static searchOpenvpnChild(dbCon, fwcloud, openvpn) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT VPN.id FROM openvpn VPN
      INNER JOIN firewall FW ON FW.id=VPN.firewall
      WHERE FW.fwcloud=${fwcloud} AND VPN.openvpn=${openvpn}`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);

                if (result.length > 0)
                    resolve({ result: true, restrictions: { OpenvpnHasChild: true } });
                else
                    resolve({ result: false });
            });
        });
    };


    public static searchIPObjInOpenvpnOpt(dbCon, ipobj, name) {
        return new Promise((resolve, reject) => {
            dbCon.query(`select openvpn from openvpn_opt where ipobj=${ipobj} and name=${dbCon.escape(name)}`, (error, result) => {
                if (error) return reject(error);
                resolve((result.length < 1) ? false : true);
            });
        });
    };


    // Get the ID of all OpenVPN configurations who's status field is not zero.
    public static getOpenvpnStatusNotZero(req, data) {
        return new Promise((resolve, reject) => {
            const sql = `SELECT VPN.id,VPN.status FROM openvpn VPN
      INNER JOIN firewall FW on FW.id=VPN.firewall
      WHERE VPN.status!=0 AND FW.fwcloud=${req.body.fwcloud}`
            req.dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                data.openvpn_status = rows;
                resolve(data);
            });
        });
    };

    public static addToGroup(req) {
        return new Promise((resolve, reject) => {
            req.dbCon.query(`INSERT INTO openvpn__ipobj_g values(${req.body.ipobj},${req.body.ipobj_g})`, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    };

    public static removeFromGroup(req) {
        return new Promise((resolve, reject) => {
            let sql = `DELETE FROM openvpn__ipobj_g WHERE ipobj_g=${req.body.ipobj_g} AND openvpn=${req.body.ipobj}`;
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    };


    public static getStatusFile(req, status_file_path) {
        return new Promise(async (resolve, reject) => {
            try {
                const fwData: any = await Firewall.getFirewallSSH(req);

                const sudo = fwData.SSHconn.username === 'root' ? '' : 'sudo';
                let data = await sshTools.runCommand(fwData.SSHconn, `${sudo} cat "${status_file_path}"`);
                // Remove the first line ()
                let lines = data.split('\n');
                if (lines[0].startsWith('[sudo] password for '))
                    lines.splice(0, 1);
                // join the array back into a single string
                data = lines.join('\n');

                resolve(data);
            } catch (error) { reject(error) }
        });
    };


    public static createOpenvpnServerInterface(req, cfg) {
        return new Promise(async (resolve, reject) => {
            try {
                let openvpn_opt: any = await this.getOptData(req.dbCon, cfg, 'dev');
                if (openvpn_opt) {
                    const interface_name = openvpn_opt.arg;

                    // If we already have an interface with the same name then do nothing.
                    const interfaces = await Interface.getInterfaces(req.dbCon, req.body.fwcloud, req.body.firewall);
                    for (let _interface of interfaces) {
                        if (_interface.name === interface_name)
                            return resolve();
                    }

                    // Create the OpenVPN server network interface.
                    const interfaceData = {
                        id: null,
                        firewall: req.body.firewall,
                        name: interface_name,
                        labelName: '',
                        type: 10,
                        interface_type: 10,
                        comment: '',
                        mac: ''
                    };

                    const interfaceId = await Interface.insertInterface(req.dbCon, interfaceData);
                    if (interfaceId) {
                        const interfaces_node: any = await Tree.getNodeUnderFirewall(req.dbCon, req.body.fwcloud, req.body.firewall, 'FDI')
                        if (interfaces_node) {
                            const nodeId = await Tree.newNode(req.dbCon, req.body.fwcloud, interface_name, interfaces_node.id, 'IFF', interfaceId, 10);

                            // Create the network address for the new interface.
                            openvpn_opt = await this.getOptData(req.dbCon, cfg, 'server');
                            if (openvpn_opt && openvpn_opt.ipobj) {
                                // Get the ipobj data.
                                const ipobj: any = await IPObj.getIpobjInfo(req.dbCon, req.body.fwcloud, openvpn_opt.ipobj);
                                if (ipobj.type === 7) { // Network
                                    const net = ip.subnet(ipobj.address, ipobj.netmask);

                                    const ipobjData = {
                                        id: null,
                                        fwcloud: req.body.fwcloud,
                                        interface: interfaceId,
                                        name: interface_name,
                                        type: 5,
                                        protocol: null,
                                        address: net.firstAddress,
                                        netmask: ipobj.netmask,
                                        diff_serv: null,
                                        ip_version: 4,
                                        icmp_code: null,
                                        icmp_type: null,
                                        tcp_flags_mask: null,
                                        tcp_flags_settings: null,
                                        range_start: null,
                                        range_end: null,
                                        source_port_start: 0,
                                        source_port_end: 0,
                                        destination_port_start: 0,
                                        destination_port_end: 0,
                                        options: null
                                    };

                                    const ipobjId = await IPObj.insertIpobj(req.dbCon, ipobjData);
                                    await Tree.newNode(req.dbCon, req.body.fwcloud, `${interface_name} (${net.firstAddress})`, nodeId, 'OIA', ipobjId, 5);
                                }
                            }
                        }
                    }
                }

                resolve();
            } catch (error) { reject(error) }
        });
    };

    //Move rules from one firewall to other.
    public static moveToOtherFirewall(dbCon, src_firewall, dst_firewall) {
        return new Promise((resolve, reject) => {
            dbCon.query(`UPDATE ${tableName} SET firewall=${dst_firewall} WHERE firewall=${src_firewall}`, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };
}