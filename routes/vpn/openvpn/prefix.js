var express = require('express');
var router = express.Router();

var api_resp = require('../../../utils/api_response');

var objModel = 'OpenvpnPrefix';

const openvpnModel = require('../../../models/vpn/openvpn/openvpn');
const policyOpenvpnModel = require('../../../models/policy/openvpn');
const policy_cModel = require('../../../models/policy/policy_c');

const fwcTreeModel = require('../../../models/tree/tree');
const restrictedCheck = require('../../../middleware/restricted');
const pkiModel = require('../../../models/vpn/pki/ca');
const ipobjModel = require('../../../models/ipobj/ipobj');
const firewallModel = require('../../../models/firewall/firewall');

module.exports = router;