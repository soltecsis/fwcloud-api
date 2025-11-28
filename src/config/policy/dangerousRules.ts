/*
  Copyright 2025 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

import dangerousRules from './dangerous-rules.json';

// Mapping of type to ipType and chain
const typeMap = {
  1: { ipType: 'IPv4', chain: 'INPUT' },
  2: { ipType: 'IPv4', chain: 'OUTPUT' },
  3: { ipType: 'IPv4', chain: 'FORWARD' },
  4: { ipType: 'IPv4', chain: 'SNAT' },
  5: { ipType: 'IPv4', chain: 'DNAT' },
  61: { ipType: 'IPv6', chain: 'INPUT' },
  62: { ipType: 'IPv6', chain: 'OUTPUT' },
  63: { ipType: 'IPv6', chain: 'FORWARD' },
  64: { ipType: 'IPv6', chain: 'SNAT' },
  65: { ipType: 'IPv6', chain: 'DNAT' },
};

type DangerousRuleInfo = {
  ruleIPType: 'IPv4' | 'IPv6';
  ruleChainType: 'INPUT' | 'OUTPUT' | 'FORWARD' | 'SNAT' | 'DNAT';
  critical: boolean;
};

export { typeMap, dangerousRules, DangerousRuleInfo };
