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
import { Column, getRepository, Entity, PrimaryColumn, Repository } from "typeorm";
import modelEventService from "../ModelEventService";
import { PolicyRule } from "./PolicyRule";
import { PolicyCompilation } from "./PolicyCompilation";
import { app } from "../../fonaments/abstract-application";
import { RepositoryService } from "../../database/repository.service";

const tableName: string = 'policy_r__openvpn_prefix';

@Entity(tableName)
export class PolicyRuleToOpenVPNPrefix extends Model {

    @PrimaryColumn()
    rule: number;

    @PrimaryColumn()
    prefix: number;

    @PrimaryColumn()
    position: number;

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

    public getTableName(): string {
        return tableName;
    }

    public async onCreate() {
        const policyCompilationRepository: Repository<PolicyCompilation> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
        await policyCompilationRepository.update({rule: this.rule}, {status_compiled: 0});
    }

    public async onUpdate() {
        const policyCompilationRepository: Repository<PolicyCompilation> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
        await policyCompilationRepository.update({rule: this.rule}, {status_compiled: 0});
    }

    public async onDelete() {
        const policyCompilationRepository: Repository<PolicyCompilation> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyCompilation);
        await policyCompilationRepository.update({rule: this.rule}, {status_compiled: 0});
    }

    //Add new policy_r__openvpn_prefix
    public static insertInRule = req => {
        return new Promise(async (resolve, reject) => {
            var policyPrefix = {
                rule: req.body.rule,
                prefix: req.body.prefix,
                position: req.body.position,
                position_order: req.body.position_order
            };
            req.dbCon.query(`insert into ${tableName} set ?`, policyPrefix, async (error, result) => {
                if (error) return reject(error);
                await modelEventService.emit('create', PolicyRuleToOpenVPNPrefix, result.insertId);
                resolve(result.insertId);
            });
        });
    }

    public static checkPrefixPosition = (dbCon, position) => {
        return new Promise((resolve, reject) => {
            dbCon.query(`select type from ipobj_type__policy_position where type=401 and position=${position}`, (error, rows) => {
                if (error) return reject(error);
                resolve((rows.length > 0) ? 1 : 0);
            });
        });
    }


    public static checkExistsInPosition = (dbCon, rule, prefix, openvpn, position) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT rule FROM ${tableName}
                WHERE rule=${rule} AND prefix=${prefix} AND position=${position}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve((rows.length > 0) ? 1 : 0);
            });
        });
    }


    public static moveToNewPosition(req) {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE ${tableName} SET rule=${req.body.new_rule}, position=${req.body.new_position}
                WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND position=${req.body.position}`;
            req.dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);
                await modelEventService.emit('update', PolicyRuleToOpenVPNPrefix, {
                    rule: req.body.rule,
                    prefix: req.body.prefix,
                    position: req.body.position
                });
                resolve();
            });
        });
    }


    public static deleteFromRulePosition(req) {
        return new Promise(async (resolve, reject) => {
            const policyRuleToOpenVPNPrefixRepository: Repository<PolicyRuleToOpenVPNPrefix> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyRuleToOpenVPNPrefix);
            const models: PolicyRuleToOpenVPNPrefix[] = await policyRuleToOpenVPNPrefixRepository.find({
                rule: req.body.rule,
                prefix: req.body.prefix,
                position: req.body.position
            });
            let sql = `DELETE FROM ${tableName} WHERE rule=${req.body.rule} AND prefix=${req.body.prefix} AND position=${req.body.position}`;
            req.dbCon.query(sql, async (error, rows) => {
                if (error) return reject(error);
                await modelEventService.emit('delete', PolicyRuleToOpenVPNPrefix, models); 
                resolve();
            });
        });
    }

    public static deleteFromRule(dbCon, rule) {
        return new Promise(async (resolve, reject) => {
            const policyRuleToOpenVPNPrefixRepository: Repository<PolicyRuleToOpenVPNPrefix> = 
								(await app().getService<RepositoryService>(RepositoryService.name)).for(PolicyRuleToOpenVPNPrefix);
            const models: PolicyRuleToOpenVPNPrefix[] = await policyRuleToOpenVPNPrefixRepository.find({
                rule: rule
            });
            dbCon.query(`DELETE FROM ${tableName} WHERE rule=${rule}`, async (error, rows) => {
                if (error) return reject(error);
                await modelEventService.emit('delete', PolicyRuleToOpenVPNPrefix, models);
                resolve();
            });
        });
    }

    //Duplicate policy_r__openvpn_prefix RULES
    public static duplicatePolicy_r__prefix(dbCon, rule, new_rule) {
        return new Promise((resolve, reject) => {
            let sql = `INSERT INTO ${tableName} (rule, prefix, position, position_order)
                (SELECT ${new_rule}, prefix, position, position_order
                from ${tableName} where rule=${rule} order by  position, position_order)`;
            dbCon.query(sql, async (error, result) => {
                await modelEventService.emit('update', PolicyRuleToOpenVPNPrefix, result.insertId);
                if (error) return reject(error);
                resolve();
            });
        });
    }
}