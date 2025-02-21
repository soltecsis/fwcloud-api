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



var errorTable = {
  // Common error codes.
  "BAD_LOGIN":            {"fwcErr": 1001, "msg": "Bad username or password"},
  "NOT_FOUND":            {"fwcErr": 1002, "msg": "Not found"},
  "ALREADY_EXISTS":       {"fwcErr": 1003, "msg": "Already exists"},
  "ALREADY_EXISTS_ID":    {"fwcErr": 1004, "msg": "Already exists with the same id"},
  "ALREADY_EXISTS_NAME":  {"fwcErr": 1005, "msg": "Already exists with the same name"},
  "NOT_ALLOWED":          {"fwcErr": 1006, "msg": "Not allowed"},
  "BAD_POSITION":         {"fwcErr": 1007, "msg": "Bad position"},
  "NOT_ADMIN_USER":       {"fwcErr": 1008, "msg": "You are not an admin user"},
  "SESSION_EXPIRED":      {"fwcErr": 1009, "msg": "Session expired"},
  "SESSION_BAD":          {"fwcErr": 1010, "msg": "Invalid session"},
  "NOT_ALLOWED_CORS":     {"fwcErr": 1011, "msg": "Not allowed by CORS"},
  "PGP_KEYS_GEN":         {"fwcErr": 1012, "msg": "PGP keys not generated"},

  // Input validation error codes.
  "NOT_ACCEPTED_METHOD":  {"fwcErr": 2001, "msg": "HTTP method not accepted by FWCloud.net API"},
  "BODY_MUST_BE_EMPTY":   {"fwcErr": 2002, "msg": "Request body must be empty for GET method"},
  "BAD_API_CALL":         {"fwcErr": 2003, "msg": "Bad API call"},
  "BAD_API_DATA":         {"fwcErr": 2004, "msg": "Bad API call data"},
  "MODULE_NOT_FOUND":     {"fwcErr": 2005, "msg": "This Express route is not controlled in the input data validation process"},
  "BAD_BODY_TYPE":        {"fwcErr": 2006, "msg": "Bad value in req.body.type"},
  "SCR_PORT_1":           {"fwcErr": 2007, "msg": "Source port end must be greater or equal than source port start"},
  "DST_PORT_1":           {"fwcErr": 2008, "msg": "Destination port end must be greater or equal than destination port start"},
  "ONLY_ONE_NOT_NEGATIVE":{"fwcErr": 2009, "msg": "Only one of ipob, ipobj_g and interface must different from -1"},

  // Tree error codes.
  "BAD_TREE_NODE_TYPE":   {"fwcErr": 3001, "msg": "Bad tree node type"},

  // Interface error codes.
  "IF_TO_IPOBJ_GROUP":    {"fwcErr": 4001, "msg": "It is not possible to add network interfaces to IP objects groups"},

  // Ipobj.
  "IPOBJ_EMPTY_CONTAINER":{"fwcErr": 5001, "msg": "Empty ipobj container"},
  "IPOBJ_BAD_IP_VERSION": {"fwcErr": 5002, "msg": "Bad object IP version"},
  "IPOBJ_MIX_IP_VERSION": {"fwcErr": 5003, "msg": "Mix of different IP version objects not allowed"},

  // VPN.
  "VPN_ONLY_CLI":         {"fwcErr": 6001, "msg": "Only OpenVPN client configurations allowed"},
  "VPN_NOT_CLI":          {"fwcErr": 6002, "msg": "This is not an OpenVPN client configuration"},
  "VPN_NOT_SER":          {"fwcErr": 6003, "msg": "This is not an OpenVPN server configuration"},
  "VPN_NOT_FOUND_CFGDIR": {"fwcErr": 6004, "msg": "OpenVPN 'client-config-dir' option not found"},
  "VPN_NOT_FOUND_STATUS": {"fwcErr": 6005, "msg": "OpenVPN 'status' option not found"},

  // Access control error codes.
  "ACC_FWCLOUD":          {"fwcErr": 7000, "msg": "FWCloud access not allowed"},
  "ACC_FIREWALL":         {"fwcErr": 7001, "msg": "Firewall access not allowed"},
  "ACC_CLUSTER":          {"fwcErr": 7002, "msg": "Cluster access not allowed"},
  "ACC_TREE_NODE":        {"fwcErr": 7003, "msg": "Tree node access not allowed"},
  "ACC_CA":               {"fwcErr": 7004, "msg": "CA access not allowed"},
  "ACC_CRT":              {"fwcErr": 7005, "msg": "CRT access not allowed"},
  "ACC_OPENVPN":          {"fwcErr": 7006, "msg": "OpenVPN access not allowed"},
  "ACC_CRT_PREFIX":       {"fwcErr": 7007, "msg": "CRT prefix access not allowed"},
  "ACC_POLICY_RULE":      {"fwcErr": 7008, "msg": "Policy rule access not allowed"},
  "ACC_IPTABLES_MARK":    {"fwcErr": 7009, "msg": "IPTables mark access not allowed"},
  "ACC_FWCLOUD_LOCK":     {"fwcErr": 7010, "msg": "FWCloud is locked by another user, only read operations are allowed"},
  
  //Limit
  "LIMIT_FWCLOUDS":       {"fwcErr": 8000, "msg": "The maximum of available FWClouds has been reached"},
  "LIMIT_FIREWALLS":      {"fwcErr": 8001, "msg": "The maximum of available Firewalls has been reached"},
  "LIMIT_CLUSTERS":       {"fwcErr": 8002, "msg": "The maximum of available Clusters has been reached"},
  "LIMIT_NODES":          {"fwcErr": 8003, "msg": "The maximum of available Nodes in Cluster has been reached"},

  "SSH_COMMUNICATION_DISABLE": {"fwcErr": 9000, "msg": "Communication by means of SSH is forbidden in the API"}
};

errorTable.other = msg => {
  return  {"fwcErr": 999999, "msg": msg};
};


//Export the object
module.exports = errorTable;
