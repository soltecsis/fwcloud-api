/*!
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

import { Repository, UpdateResult, DeleteResult, InsertResult, EntityRepository } from "typeorm";
import { PolicyGroup } from "../models/policy/PolicyGroup";
import { PolicyRule } from "../models/policy/PolicyRule";

@EntityRepository(PolicyGroup)
export class PolicyGroupRepository extends Repository<PolicyGroup> {

    public async moveToFirewall(id: number, firewallId: number): Promise<UpdateResult> {
        return await this.update(id, {
            firewall: { id: firewallId }
        });
    }

    public async moveFirewallGroupsToFirewall(firewallId: number, destinationFirewallId: number): Promise<UpdateResult> {
        return await this.update({ firewall: { id: firewallId } }, { firewall: { id: destinationFirewallId } });
    }

    public async deleteFirewallGroups(firewallId: number): Promise<DeleteResult> {
        return await this.delete({ firewall: { id: firewallId } });
    }

    /**
     * Removes a policyGroup if it is empty
     * 
     * @param policyGroup 
     */
    public async deleteIfEmpty(policyGroup: PolicyGroup): Promise<PolicyGroup>
    {
        if((await this.createQueryBuilder().relation(PolicyGroup, "policyRules").of(policyGroup).loadMany()).length === 0) {
            await this.delete(policyGroup);
            return policyGroup;
        }

        return policyGroup;
    }

    /**
     * Clone a policy group
     * 
     * @param original 
     */
    public async clone(original: PolicyGroup): Promise<PolicyGroup> {
        const cloned: PolicyGroup = this.create({
            firewallId: original.firewall.id,
            name: original.name,
            comment: original.comment,
            groupstyle: original.groupstyle,
            parentId: original.parentId
        });

        return await this.save(cloned);
    }

    public async cloneFirewallPolicyGroups(firewallId: number): Promise<any> {
        const policyGroups: Array<PolicyGroup> = await this.find({ firewall: { id: firewallId } });

        return await Promise.all(policyGroups.map((policyGroup: PolicyGroup) => {
            this.clone(policyGroup);
        }));
    }

    public async isEmpty(firewallId: number, groupId: number): Promise<boolean> {
        return (await this.find({ firewallId: firewallId, parentId: groupId })).length > 0
    }
}