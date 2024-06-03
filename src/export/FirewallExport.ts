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

import db from '../database/database-manager';
const fwcError = require('../utils/error_table');


export class FirewallExport {

    /**
     * Export firewall data
     *  
     */
    public static exportFirewall(id) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
    
                const sql = 'select * from firewall where id=' + connection.escape(id);
                connection.query(sql, async (error, firewallData) => {
                    if (error) return reject(error);
                    if (firewallData.length!==1) return reject(fwcError.NOT_FOUND);
    
                    try {
                        firewallData[0].interfaces = await this.exportInterfaces(connection,id);
                        firewallData[0].policy = await this.exportPolicy(connection,id);
                    } catch (error) {
                        reject(error);
                    }
    
                    resolve(firewallData[0]);
                });
            });
        });
    }


    private static exportAddrs(row) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                const sql = 'select * from ipobj where interface=' + connection.escape(row.id);
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    }
    
    private static exportInterfaces(connection, id) {
        return new Promise((resolve, reject) => {
            const sql = 'select * from interface where firewall=' + connection.escape(id);
            connection.query(sql, (error, interfaces) => {
                if (error) return reject(error);
    
                // The order is preserved regardless of what resolved first	
                Promise.all(interfaces.map(row => this.exportAddrs(row)))
                .then(addrs => {
                    for(let i=0; i<interfaces.length; i++)
                        interfaces[i].addresses = addrs[i];
                    resolve(interfaces);
                })
                .catch(error => reject(error));
            });
        });
    }
    
    
    private static exportRuleInterfaces(row) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                const sql = 'select * from policy_r__interface where rule=' + connection.escape(row.id);
                connection.query(sql, (error, rows) => {
                    if (error) return reject(error);
                    resolve(rows);
                });
            });
        });
    }
    
    private static exportPolicyInterfaces(rules) {
        return new Promise((resolve, reject) => {
            // The order is preserved regardless of what resolved first	
            Promise.all(rules.map(row => this.exportRuleInterfaces(row)))
            .then(ruleInterfaces => {
                for(let i=0; i<ruleInterfaces.length; i++)
                    rules[i].interfaces = ruleInterfaces[i];
                resolve(rules);
            })
            .catch(error => reject(error));
        });
    }
    
    
    private static exportRuleIpobjData(ruleIpobj) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
          let sql ='';
          if (ruleIpobj.ipobj!==-1)
            sql = 'select * from ipobj where id=' + connection.escape(ruleIpobj.ipobj);
          else if (ruleIpobj.ipobj_g!==-1)
            sql = 'select * from ipobj_g where id=' + connection.escape(ruleIpobj.ipobj_g);
          else if (ruleIpobj.interface!==-1)
            sql = 'select * from interface where id=' + connection.escape(ruleIpobj.interface);
                connection.query(sql, (error, ipobjDetail) => {
                    if (error) return reject(error);
                    resolve(ipobjDetail);
                });
            });
        });
    }
    
    private static exportRuleIpobjs(row) {
        return new Promise((resolve, reject) => {
            db.get((error, connection) => {
                if (error) return reject(error);
                const sql = 'select * from policy_r__ipobj where rule=' + connection.escape(row.id);
                connection.query(sql, (error, ipobjs) => {
                    if (error) return reject(error);
    
                    Promise.all(ipobjs.map(ruleIpobj => this.exportRuleIpobjData(ruleIpobj)))
                    .then(ipobjsDetailed => {
                        for(let i=0; i<ipobjs.length; i++)
                            ipobjs[i].data = ipobjsDetailed[i];
                        resolve(ipobjs);
                    })
                    .catch(error => reject(error));
                });
            });
        });
    }
    
    private static exportPolicyIpobjs(rules) {
        return new Promise((resolve, reject) => {
            // The order is preserved regardless of what resolved first	
            Promise.all(rules.map(data => this.exportRuleIpobjs(data)))
            .then(ruleIpobjs => {
                for(let i=0; i<ruleIpobjs.length; i++)
                    rules[i].ipobjs = ruleIpobjs[i];
                resolve(rules);
            })
            .catch(error => reject(error));
        });
    }
    
    private static exportPolicy(connection, id) {
        return new Promise((resolve, reject) => {
            const sql = 'select * from policy_r where firewall=' + connection.escape(id);
            connection.query(sql, async (error, rules) => {
                if (error) return reject(error);
    
                try {
                    await this.exportPolicyInterfaces(rules);
                    await this.exportPolicyIpobjs(rules);
                    resolve(rules);
                }	catch(error) { reject(error); } 
            });
        });
    }
}