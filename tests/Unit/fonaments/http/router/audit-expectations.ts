/*
    Copyright 2026 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
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

export type AuditRouteExpectation = {
  audited: boolean;
  notes?: string;
};

export type AuditRouteExpectationManifest = Readonly<Record<string, AuditRouteExpectation>>;

// These routes are excluded from the manifest check because they are internal health probes.
export const INTERNAL_MUTATING_ROUTE_EXCEPTIONS = new Set<string>(['PUT /ping']);

// Single source of truth for mutating controller route audit expectations.
// Key format: '<METHOD> <normalized-path>'.
// When adding a mutating controller route, add or update the corresponding key here.
export const auditRouteExpectationManifest: AuditRouteExpectationManifest = {
  'DELETE /aiassistant': { audited: true },
  'DELETE /backups/:backup': { audited: true },
  'DELETE /fwclouds/:fwcloud/assistant/drafts/:draft': { audited: true },
  'DELETE /fwclouds/:fwcloud/assistant/profiles/:code/:version': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routeGroups/:routeGroup': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routingGroups/:routingGroup': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routingRules/:routingRule': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routingRules/bulkRemove': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/:route': {
    audited: true,
  },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/bulkRemove': {
    audited: true,
  },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpGroups/:dhcpgroup': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/:dhcp': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/bulkRemove': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyGroups/:haproxygroup': {
    audited: true,
  },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/:haproxy': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/bulkRemove': { audited: true },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedGroups/:keepalivedgroup': {
    audited: true,
  },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/:keepalived': {
    audited: true,
  },
  'DELETE /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/bulkRemove': {
    audited: true,
  },
  'DELETE /fwclouds/:fwcloud/snapshots/:snapshot': { audited: true },
  'DELETE /profile/tfa/setup': { audited: true },
  'POST /auditlogarchives': { audited: true },
  'POST /backups': { audited: true },
  'POST /backups/:backup/restore': { audited: true },
  'POST /backups/import': { audited: true },
  'POST /fwclouds': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/drafts/:draft/apply': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/drafts/:draft/preview': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/drafts/generate': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/profiles': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/profiles/from-source': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/profiles/validate': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /fwclouds/:fwcloud/assistant/profiles/:code/versions': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/profiles/:code/:version/clone': { audited: true },
  'POST /fwclouds/:fwcloud/assistant/profiles/:code/:version/apply': { audited: true },
  'POST /fwclouds/:fwcloud/export': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/AIassistant': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/AIassistant/rules': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/ipsecs/:ipsec/installer': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/openvpns/:openvpn/installer': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/policyRules/download': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routeGroups': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routingGroups': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routingRules': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routingRules/copy': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routingTables': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes': {
    audited: true,
  },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/copy': {
    audited: true,
  },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpGroups': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/copy': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyGroups': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/copy': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedGroups': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/copy': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/:firewall/wireguards/:wireguard/installer': { audited: true },
  'POST /fwclouds/:fwcloud/firewalls/communication/info': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /fwclouds/:fwcloud/firewalls/communication/ping': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /fwclouds/:fwcloud/firewalls/plugin': { audited: true },
  'POST /fwclouds/:fwcloud/snapshots': { audited: true },
  'POST /fwclouds/:fwcloud/snapshots/:snapshot/restore': { audited: true },
  'POST /fwclouds/import': { audited: true },
  'POST /openvpnarchives': { audited: true },
  'POST /profile/tfa/setup': { audited: true },
  'POST /profile/tfa/verify': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'POST /systemctl': { audited: true },
  'POST /vpn/ipsec': { audited: true },
  'POST /vpn/ipsec/prefix': { audited: true },
  'POST /vpn/wireguard': { audited: true },
  'POST /vpn/wireguard/prefix': { audited: true },
  'PUT /aiassistant': { audited: true },
  'PUT /auditlogarchives/config': { audited: true },
  'PUT /auditlogs': { audited: false, notes: 'Read-style operation over a mutating HTTP verb.' },
  'PUT /backups/config': { audited: true },
  'PUT /fwclouds/:fwcloud': { audited: true },
  'PUT /fwclouds/:fwcloud/cas/:ca': { audited: true },
  'PUT /fwclouds/:fwcloud/cas/:ca/crts/:crt': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routeGroups/:routeGroup': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingGroups/:routingGroup': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingRules/:routingRule': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingRules/bulkUpdate': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingRules/move': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingRules/moveFrom': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/:route': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/bulkUpdate': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/move': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/moveInterface': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/moveTo': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/routingTables/:routingTable/routes/moveToGateway': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/openvpns/:openvpn/statusSampling': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpGroups/:dhcpgroup': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/:dhcp': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/bulkUpdate': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/install': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/move': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/dhcpRules/moveFrom': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyGroups/:haproxygroup': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/:haproxy': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/bulkUpdate': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/install': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/move': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/haproxyRules/moveFrom': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedGroups/:keepalivedgroup': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/:keepalived': {
    audited: true,
  },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/bulkUpdate': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/install': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/move': { audited: true },
  'PUT /fwclouds/:fwcloud/firewalls/:firewall/system/keepalivedRules/moveFrom': { audited: true },
  'PUT /fwclouds/:fwcloud/snapshots/:snapshot': { audited: true },
  'PUT /iptables-save/export': { audited: true },
  'PUT /iptables-save/import': { audited: true },
  'PUT /openvpnarchives/config': { audited: true },
  'PUT /updates/api': { audited: false, notes: 'Read-style operation over a mutating HTTP verb.' },
  'PUT /updates/ui': { audited: false, notes: 'Read-style operation over a mutating HTTP verb.' },
  'PUT /updates/updater': { audited: true },
  'PUT /updates/websrv': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec': { audited: true },
  'PUT /vpn/ipsec/client/options/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/client/options/update': { audited: true },
  'PUT /vpn/ipsec/clients/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/config/filename': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/del': { audited: true },
  'PUT /vpn/ipsec/file/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/info/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/install': { audited: true },
  'PUT /vpn/ipsec/ip/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/ipobj/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/prefix': { audited: true },
  'PUT /vpn/ipsec/prefix/del': { audited: true },
  'PUT /vpn/ipsec/prefix/info/get': { audited: true },
  'PUT /vpn/ipsec/prefix/restricted': { audited: true },
  'PUT /vpn/ipsec/prefix/where': { audited: true },
  'PUT /vpn/ipsec/restricted': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/ipsec/uninstall': { audited: true },
  'PUT /vpn/ipsec/where': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard': { audited: true },
  'PUT /vpn/wireguard/client/options/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/client/options/update': { audited: true },
  'PUT /vpn/wireguard/clients/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/config/filename': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/del': { audited: true },
  'PUT /vpn/wireguard/file/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/info/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/install': { audited: true },
  'PUT /vpn/wireguard/ip/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/ipobj/get': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/prefix': { audited: true },
  'PUT /vpn/wireguard/prefix/del': { audited: true },
  'PUT /vpn/wireguard/prefix/info/get': { audited: true },
  'PUT /vpn/wireguard/prefix/restricted': { audited: true },
  'PUT /vpn/wireguard/prefix/where': { audited: true },
  'PUT /vpn/wireguard/restricted': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
  'PUT /vpn/wireguard/uninstall': { audited: true },
  'PUT /vpn/wireguard/where': {
    audited: false,
    notes: 'Read-style operation over a mutating HTTP verb.',
  },
};
