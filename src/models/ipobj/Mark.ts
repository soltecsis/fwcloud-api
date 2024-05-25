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
import { PrimaryGeneratedColumn, Column, Entity, getRepository, ManyToOne, JoinColumn, OneToMany, ManyToMany } from "typeorm";
import { FwCloud } from "../fwcloud/FwCloud";
import { PolicyRule } from "../policy/PolicyRule";
import { RoutingRule } from "../routing/routing-rule/routing-rule.model";
import { RoutingRuleToMark } from "../routing/routing-rule/routing-rule-to-mark.model";

const fwcError = require('../../utils/error_table');

const tableName: string = 'mark';

@Entity(tableName)
export class Mark extends Model {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    code: number;

    @Column()
    name: string;

    @Column()
    comment: string;

    @Column()
    created_at: Date;

    @Column()
    updated_at: Date;

    @Column()
    created_by: number;

    @Column()
    updated_by: number;

    @Column({name: 'fwcloud'})
    fwCloudId: number;
    
    @ManyToOne(type => FwCloud, fwcloud => fwcloud.marks)
    @JoinColumn({
        name: 'fwcloud'
    })
    fwCloud: FwCloud;

    @OneToMany(type => PolicyRule, policyRule => policyRule.mark)
    policyRules: Array<PolicyRule>;

    @OneToMany(() => RoutingRuleToMark, model => model.mark)
    routingRuleToMarks: RoutingRuleToMark[];

    public getTableName(): string {
        return tableName;
    }

    // Verify if the iptables mark exists for the indicated fwcloud.
    public static existsMark(dbCon, fwcloud, code) {
        return new Promise((resolve, reject) => {
            dbCon.query(`SELECT id FROM ${tableName} WHERE code=${code} AND fwcloud=${fwcloud}`, (error, result) => {
                if (error) return reject(error);
                resolve((result.length > 0) ? result[0].id : 0);
            });
        });
    };

    // Add new iptables mark for the indicated fwcloud.
    public static createMark(req) {
        return new Promise((resolve, reject) => {
            const markData = {
                fwcloud: req.body.fwcloud,
                code: req.body.code,
                name: req.body.name,
                comment: req.body.comment
            };
            req.dbCon.query(`INSERT INTO ${tableName} SET ?`, markData, (error, result) => {
                if (error) return reject(error);
                resolve(result.insertId);
            });
        });
    };

    // Modify an iptables mark.
    public static modifyMark(req): Promise<void> {
        return new Promise((resolve, reject) => {
            let sql = `UPDATE ${tableName} SET code=${req.body.code}, name=${req.dbCon.escape(req.body.name)},
	  comment=${req.dbCon.escape(req.body.comment)} WHERE id=${req.body.mark}`
            req.dbCon.query(sql, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    // Delete an iptables mark.
    public static deleteMark(dbCon, mark): Promise<void> {
        return new Promise((resolve, reject) => {
            dbCon.query(`DELETE from ${tableName} WHERE id=${mark}`, (error, result) => {
                if (error) return reject(error);
                resolve();
            });
        });
    };

    public static getMark(dbCon, mark) {
        return new Promise((resolve, reject) => {
            dbCon.query(`select * from ${tableName} WHERE id=${mark}`, (error, result) => {
                if (error) return reject(error);
                if (result.length !== 1) return reject(fwcError.NOT_FOUND);
                resolve(result[0]);
            });
        });
    };



    public static searchMarkInRule(dbCon, fwcloud, mark) {
        return new Promise((resolve, reject) => {
            var sql = `select R.id as rule, R.firewall, FW.id as firewall_id, FW.name as firewall_name,
	        M.id obj_id, M.name obj_name,
	        R.id as rule_id, R.type rule_type, (select id from ipobj_type where id=30) as obj_type_id,
			PT.name rule_type_name,
			FW.cluster as cluster_id, IF(FW.cluster is null,null,(select name from cluster where id=FW.cluster)) as cluster_name
		 	from policy_r R
			inner join mark M on M.id=R.mark
			inner join firewall FW on FW.id=R.firewall
	        inner join policy_type PT on PT.id=R.type
			where FW.fwcloud=${fwcloud} and R.mark=${mark}`;
            dbCon.query(sql, (error, rows) => {
                if (error) return reject(error);
                resolve(rows);
            });
        });
    };

    public static searchMarkUsage(dbCon, fwcloud, mark) {
        return new Promise(async (resolve, reject) => {
            try {
                let search: any = {};
                search.result = false;
                search.restrictions = {};

                search.restrictions.MarkInRule = await this.searchMarkInRule(dbCon, fwcloud, mark);

                search.restrictions.MarkInRoutingRule = await getRepository(RoutingRule).createQueryBuilder('routing_rule')
                    .addSelect('firewall.id', 'firewall_id').addSelect('firewall.name', 'firewall_name')
                    .addSelect('cluster.id', 'cluster_id').addSelect('cluster.name', 'cluster_name')
                    .innerJoin('routing_rule.routingRuleToMarks', 'routingRuleToMarks')
                    .innerJoin('routingRuleToMarks.mark', 'mark', 'mark.id = :mark', {mark: mark})
                    .innerJoin('routing_rule.routingTable', 'table')
                    .innerJoin('table.firewall', 'firewall')
                    .leftJoin('firewall.cluster', 'cluster')
                    .where(`firewall.fwCloudId = :fwcloud`, {fwcloud: fwcloud})
                    .getRawMany();

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

}