/*!
    Copyright 2021 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import { PolicyRuleToIPObj } from '../../../../src/models/policy/PolicyRuleToIPObj';

export function positionsEmpty(data: any): boolean {
  if (!data || !data.positions) return false;

  for(let i=0; i<data.positions.length; i++) {
      if (data.positions[i].ipobjs.length !== 0) return false;
  }

  return true;
}

export function searchInPolicyData(data: any, position:number, id: number): boolean {
  for (let i=0; i<data.positions.length; i++) {
    if (data.positions[i].id === position) {
      for (let j=0; j<data.positions[i].ipobjs.length; j++) {
        if (data.positions[i].ipobjs[j].id === id) return true;
      }
      return false;
    }
  }

  return false;
}

export async function populateRule(rule: number, position: number, ipobj: number): Promise<void> {
  await PolicyRuleToIPObj.insertPolicy_r__ipobj({
    rule: rule,
    ipobj: ipobj, // TCP or UDP std objects
    ipobj_g: -1,
    interface: -1,
    position: position,
    position_order: 1
  });
}

