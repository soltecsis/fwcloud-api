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

import Model from "../Model";
import modelEventService from "../ModelEventService";
import { Entity, Column, getRepository, PrimaryColumn, Repository, ManyToOne, JoinColumn } from "typeorm";
import { PolicyCompilation } from "./PolicyCompilation";
import { app } from "../../fonaments/abstract-application";
import { RepositoryService } from "../../database/repository.service";
import { PolicyPosition } from "./PolicyPosition";
import { OpenVPN } from "../vpn/openvpn/OpenVPN";
import { PolicyRule } from "./PolicyRule";

const tableName: string = 'policy_r__openvpn';

@Entity(tableName)
export class PolicyRuleToOpenVPN extends Model {
    
    @PrimaryColumn({name: 'rule'})
    policyRuleId: number;

    @PrimaryColumn({name: 'openvpn'})
	openVPNId: number;

	@PrimaryColumn({name: 'position'})
    policyPositionId: number;
    
    @Column()
    position_order: number;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @ManyToOne(type => PolicyPosition, policyPosition => policyPosition.policyRuleToOpenVPNs)
    @JoinColumn({
        name: 'position'
    })
    policyPosition: PolicyPosition;

    @ManyToOne(type => OpenVPN, openVPN => openVPN.policyRuleToOpenVPNs)
    @JoinColumn({
        name: 'openvpn'
    })
    openVPN: OpenVPN;

    @ManyToOne(type => PolicyRule, policyRule => policyRule.policyRuleToOpenVPNs)
    @JoinColumn({
        name: 'rule'
    })
    policyRule: PolicyRule;

    public getTableName(): string {
        return tableName;
    }

    public async onCreate() {
        const policyCompilationRepository: Repository<PolicyCompilation> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
        await policyCompilationRepository.update({policyRuleId: this.policyRuleId}, {status_compiled: 0});
    }

    public async onUpdate() {
        const policyCompilationRepository: Repository<PolicyCompilation> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
        await policyCompilationRepository.update({policyRuleId: this.policyRuleId}, {status_compiled: 0});
    }

    public async onDelete() {
        const policyCompilationRepository: Repository<PolicyCompilation> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
        await policyCompilationRepository.update({policyRuleId: this.policyRuleId}, {status_compiled: 0});
    }

    //Add new policy_r__openvpn
    public static insertInRule(req) {
        return new Promise(async (resolve, reject) => {
            var policyOpenvpn = {
                rule: req.body.rule,
                openvpn: req.body.openvpn,
                position: req.body.position,
                position_order: req.body.position_order
            };
            req.dbCon.query(`insert into ${tableName} set ?`, policyOpenvpn, async (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    }

    public static checkOpenvpnPosition(dbCon,position) {
        return new Promise((resolve, reject) => {
            dbCon.query(`select type from ipobj_type__policy_position where type=311 and position=${position}`, (error, rows) => {
                if (error) return reject(error);
                resolve((rows.length>0)?1:0);
            });
        });
    }


    public static checkExistsInPosition(dbCon,rule,openvpn,position) {
        return new Promise((resolve, reject) => {
            let sql = `SELECT rule FROM ${tableName}
                WHERE rule=${rule} AND openvpn=${openvpn} AND position=${position}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve((rows.length>0)?1:0);
            });
        });
    }


    public static moveToNewPosition(req) {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE ${tableName} SET rule=${req.body.new_rule}, position=${req.body.new_position}
                WHERE rule=${req.body.rule} AND openvpn=${req.body.openvpn} AND position=${req.body.position}`;
            req.dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }


    public static deleteFromRulePosition(req) {
        return new Promise(async (resolve, reject) => {
            const policyRuleToOpenVPNRepository: Repository<PolicyRuleToOpenVPN> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyRuleToOpenVPN);
            const models: PolicyRuleToOpenVPN[] = await policyRuleToOpenVPNRepository.find({
                policyRuleId: req.body.rule,
                openVPNId: req.body.openvpn,
                policyPositionId: req.body.position
            });
            let sql = `DELETE FROM ${tableName} WHERE rule=${req.body.rule} AND openvpn=${req.body.openvpn} AND position=${req.body.position}`;
            req.dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }

    public static deleteFromRule(dbCon,rule) {
        return new Promise(async (resolve, reject) => {
            const policyRuleToOpenVPNRepository: Repository<PolicyRuleToOpenVPN> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyRuleToOpenVPN);
            const models: PolicyRuleToOpenVPN[] = await policyRuleToOpenVPNRepository.find({
                policyRuleId: rule
            });
            dbCon.query(`DELETE FROM ${tableName} WHERE rule=${rule}`, async (error, rows) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }


    //Duplicate policy_r__openvpn RULES
    public static duplicatePolicy_r__openvpn(dbCon, rule, new_rule) {
        return new Promise((resolve, reject) => {
            let sql = `INSERT INTO ${tableName} (rule, openvpn, position,position_order)
                (SELECT ${new_rule}, openvpn, position, position_order
                from ${tableName} where rule=${rule} order by  position, position_order)`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    }


    public static searchOpenvpnInRule(dbCon,fwcloud,openvpn) {
        return new Promise((resolve, reject) => {
            var sql = `select O.*, FW.id as firewall_id, FW.name as firewall_name, 
                O.openvpn obj_id, CRT.cn obj_name,
                R.id as rule_id, R.type rule_type, 311 as obj_type_id,
                PT.name rule_type_name, O.position as rule_position_id, P.name rule_position_name,
                FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
            from policy_r__openvpn O
                inner join policy_r R on R.id=O.rule
                inner join firewall FW on FW.id=R.firewall
                inner join policy_position P on P.id=O.position
                inner join policy_type PT on PT.id=R.type
                inner join openvpn VPN on VPN.id=O.openvpn
                inner join crt CRT on CRT.id=VPN.crt
                where FW.fwcloud=${fwcloud} and O.openvpn=${openvpn}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    }

    public static searchOpenvpnInGroup(dbCon,fwcloud,openvpn) {
        return new Promise((resolve, reject) => {
            var sql = `select P.*, P.ipobj_g group_id, G.name group_name,
                311 obj_type_id, CRT.cn obj_name
                from openvpn__ipobj_g P
                inner join openvpn VPN on VPN.id=P.openvpn			
                inner join crt CRT on CRT.id=VPN.crt
                inner join ipobj_g G on G.id=P.ipobj_g
                where G.fwcloud=${fwcloud} and P.openvpn=${openvpn}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    }

    public static getConfigsUnderOpenvpnPrefix(dbCon,openvpn_server_id,prefix_name) {
        return new Promise((resolve, reject) => {
            // Get all OpenVPN client configs under an openvpn configuration server whose CRT common name matches the prefix name.
            var sql = `select VPN.id from openvpn VPN
                inner join crt CRT on CRT.id=VPN.crt
                where VPN.openvpn=${openvpn_server_id} and CRT.type=1 and CRT.cn like CONCAT(${dbCon.escape(prefix_name)},'%')`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    }

    public static searchLastOpenvpnInPrefixInRule(dbCon,fwcloud,openvpn) {
        return new Promise((resolve, reject) => {
            // Fisrt get all the OpenVPN prefixes in rules to which the openvpn configuration belongs.
            var sql = `select P.rule rule_id, P.prefix, PRE.openvpn, PRE.name, R.type rule_type, 311 obj_type_id, CRT.cn obj_name,
                PT.name rule_type_name, P.position rule_position_id, PP.name rule_position_name, R.firewall firewall_id, F.name firewall_name,
                F.cluster as cluster_id, IF(F.cluster is null,null,(select name from cluster where id=F.cluster)) as cluster_name
                from policy_r__openvpn_prefix P
                inner join policy_r R on R.id=P.rule
                inner join firewall F on F.id = R.firewall
                inner join policy_position PP on PP.id=P.position
                inner join policy_type PT on PT.id=R.type
                inner join openvpn_prefix PRE on PRE.id=P.prefix
                inner join openvpn VPN on VPN.openvpn=PRE.openvpn
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
            dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);

                let result = [];
                try {
                    for(let row of rows) {
                        let data: any = await this.getConfigsUnderOpenvpnPrefix(dbCon,row.openvpn,row.name);
                        // We are the last OpenVPN client config in the prefix used in and openvpn server and in a rule.
                        if (data.length===1 && data[0].id===openvpn) 
                            result.push(row);
                    }
                } catch(error) { return reject(error) }

                resolve(result);
            });
        });
    }

    public static searchLastOpenvpnInPrefixInGroup(dbCon,fwcloud,openvpn) {
        return new Promise((resolve, reject) => {
            // Fisrt get all the OpenVPN prefixes in groups to which the openvpn configuration belongs.
            var sql = `select P.prefix, PRE.openvpn, PRE.name, GR.id group_id, GR.name group_name
                from openvpn_prefix__ipobj_g P
                inner join ipobj_g GR on GR.id=P.ipobj_g
                inner join openvpn_prefix PRE on PRE.id=P.prefix
                inner join openvpn VPN on VPN.openvpn=PRE.openvpn
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
            dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);

                let result = [];
                try {
                    for(let row of rows) {
                        let data: any = await this.getConfigsUnderOpenvpnPrefix(dbCon,row.openvpn,row.name);
                        // We are the last OpenVPN client config in the prefix used in and openvpn server and in a rule.
                        if (data.length===1 && data[0].id===openvpn) 
                            result.push(row);
                    }
                } catch(error) { return reject(error) }

                resolve(result);
            });
        });
    }

    public static searchOpenvpnInPrefixInRule(dbCon,fwcloud,openvpn) {
        return new Promise((resolve, reject) => {
            // Get all the OpenVPN prefixes in rules to which the openvpn configuration belongs.
            var sql = `select R.firewall,P.rule from policy_r__openvpn_prefix P
                inner join openvpn_prefix PRE on PRE.id=P.prefix
                inner join openvpn VPN on VPN.openvpn=PRE.openvpn
                inner join crt CRT on CRT.id=VPN.crt
                inner join policy_r R on R.id=P.rule
                inner join firewall F on F.id=R.firewall
                where F.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    }

    public static searchOpenvpnInPrefixInGroup(dbCon,fwcloud,openvpn) {
        return new Promise((resolve, reject) => {
            // Get all the OpenVPN prefixes in groups to which the openvpn configuration belongs.
            var sql = `select P.ipobj_g from openvpn_prefix__ipobj_g P
                inner join openvpn_prefix PRE on PRE.id=P.prefix
                inner join openvpn VPN on VPN.openvpn=PRE.openvpn
                inner join crt CRT on CRT.id=VPN.crt
                inner join ca CA on CA.id=CRT.ca
                where CA.fwcloud=${fwcloud} and VPN.id=${openvpn} and CRT.type=1 and CRT.cn like CONCAT(PRE.name,'%')`;
            dbCon.query(sql, async (error, result) => {
                if (error) return reject(error);
                resolve(result);
            });
        });
    }
}