/*!
    Copyright 2024 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from "typeorm";
import Model from "../../../Model";
import { HAProxyRule } from "./haproxy_r.model";
import { IPObj } from "../../../ipobj/IPObj";

const tableName = "haproxy_r__ipobj";

@Entity({ name: tableName })
export class HAProxyRuleToIPObj extends Model {
  @PrimaryColumn({ name: "rule" })
  haproxyRuleId: number;

  @PrimaryColumn({ name: "ipobj" })
  ipObjId: number;

  @Column({ type: Number })
  order: number;

  @ManyToOne(() => HAProxyRule, (haproxyRule) => haproxyRule.backendIps, {
    orphanedRowAction: "delete",
  })
  @JoinColumn({ name: "rule" })
  haproxyRule: HAProxyRule;

  @ManyToOne(() => IPObj, (ipobj) => ipobj.haproxyRuleToIPObjs, {
    orphanedRowAction: "delete",
  })
  @JoinColumn({ name: "ipobj" })
  ipObj: IPObj;

  public getTableName(): string {
    return tableName;
  }
}
