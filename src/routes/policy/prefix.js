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

var express = require('express');
var router = express.Router();

import { OpenVPNPrefix } from '../../models/vpn/openvpn/OpenVPNPrefix';
import { PolicyRuleToOpenVPNPrefix } from '../../models/policy/PolicyRuleToOpenVPNPrefix';
import { Firewall } from '../../models/firewall/Firewall';
import { PolicyRuleToIPObj } from '../../models/policy/PolicyRuleToIPObj';
import { logger } from '../../fonaments/abstract-application';
import { PolicyRuleToWireGuardPrefix } from '../../models/policy/PolicyRuleToWireguardPrefix';
import { WireGuardPrefix } from '../../models/vpn/wireguard/WireGuardPrefix';
import { PolicyRuleToIPSecPrefix } from '../../models/policy/PolicyRuleToIPSecPrefix';
import { IPSecPrefix } from '../../models/vpn/ipsec/IPSecPrefix';

const utilsModel = require('../../utils/utils.js');
const fwcError = require('../../utils/error_table');

/* Create New policy_r__VPN_prefix */
router.post('/:vpnType(openvpn|wireguard|ipsec)?', utilsModel.disableFirewallCompileStatus, async (req, res) => {
  try {
    if (
      (req.prefix.prefix_type == 'openvpn' &&
        (
          await OpenVPNPrefix.getOpenvpnClientesUnderPrefix(
            req.dbCon,
            req.prefix.openvpn,
            req.prefix.name,
          )
        ).length < 1) ||
      (req.prefix.prefix_type == 'wireguard' &&
        (
          await WireGuardPrefix.getWireGuardClientsUnderPrefix(
            req.dbCon,
            req.prefix.wireguard,
            req.prefix.name,
          )
        ).length < 1) ||
      (req.prefix.prefix_type == 'ipsec' &&
        (
          await IPSecPrefix.getIPSecClientsUnderPrefix(
            req.dbCon,
            req.prefix.ipsec,
            req.prefix.name,
          )
        ).length < 1)
    ) {
      throw fwcError.IPOBJ_EMPTY_CONTAINER;
    }

    if (
      (req.prefix.prefix_type == 'openvpn' &&
        !(await PolicyRuleToOpenVPNPrefix.checkPrefixPosition(req.dbCon, req.body.position))) ||
      (req.prefix.prefix_type == 'wireguard' &&
        !(await PolicyRuleToWireGuardPrefix.checkPrefixPosition(req.dbCon, req.body.position))) ||
      (req.prefix.prefix_type == 'ipsec' &&
        !(await PolicyRuleToIPSecPrefix.checkPrefixPosition(req.dbCon, req.body.position)))
    ) {
      throw fwcError.ALREADY_EXISTS;
    }
    if (req.prefix.prefix_type == 'openvpn') {
      await PolicyRuleToOpenVPNPrefix.insertInRule(req);
    } else if (req.prefix.prefix_type == 'wireguard') {
      await PolicyRuleToWireGuardPrefix.insertInRule(req);
    } else if (req.prefix.prefix_type == 'ipsec') {
      await PolicyRuleToIPSecPrefix.insertInRule(req);
    }

    res.status(204).end();
  } catch (error) {
    logger().error('Error creating new policy_r__openvpn_prefix: ' + JSON.stringify(error));
    res.status(400).json(error);
  }
});

/* Update POSITION policy_r__VPN_prefix that exist */
router.put('/:vpnType(openvpn|wireguard|ipsec)?/move', utilsModel.disableFirewallCompileStatus, async (req, res) => {
  try {
    if (
      req.prefix.prefix_type == 'openvpn' &&
      (
        await OpenVPNPrefix.getOpenvpnClientesUnderPrefix(
          req.dbCon,
          req.prefix.openvpn,
          req.prefix.name,
        )
      ).length < 1 &&
      req.prefix.prefix_type == 'wireguard' &&
      (
        await WireGuardPrefix.getWireGuardClientsUnderPrefix(
          req.dbCon,
          req.prefix.openvpn,
          req.prefix.name,
        )
      ).length < 1 &&
      req.prefix.prefix_type == 'ipsec' &&
      (
        await IPSecPrefix.getIPSecClientsUnderPrefix(
          req.dbCon,
          req.prefix.openvpn,
          req.prefix.name,
        )
      ).length < 1
    ) {
      throw fwcError.IPOBJ_EMPTY_CONTAINER;
    }

    if (
      (req.prefix.prefix_type == 'openvpn' &&
        !(await PolicyRuleToOpenVPNPrefix.checkPrefixPosition(req.dbCon, req.body.position))) ||
      (req.prefix.prefix_type == 'wireguard' &&
        !(await PolicyRuleToWireGuardPrefix.checkPrefixPosition(req.dbCon, req.body.position))) ||
      (req.prefix.prefix_type == 'ipsec' &&
        !(await PolicyRuleToIPSecPrefix.checkIPSecPrefixPosition(req.dbCon, req.body.position)))
    ) {
      throw fwcError.ALREADY_EXISTS;
    }

    // Get content of positions.
    const content = await PolicyRuleToIPObj.getPositionsContent(
      req.dbCon,
      req.body.position,
      req.body.new_position,
    );
    if (content.content1 !== 'O' || content.content2 !== 'O') throw fwcError.BAD_POSITION;

    await Firewall.updateFirewallStatus(req.body.fwcloud, req.body.firewall, '|3');

    // Move VPN configuration object to the new position.
    if (req.prefix.prefix_type == 'openvpn') {
      await PolicyRuleToOpenVPNPrefix.moveToNewPosition(req);
    } else if (req.prefix.prefix_type == 'wireguard') {
      await PolicyRuleToWireGuardPrefix.moveToNewPosition(req);
    } else if (req.prefix.prefix_type == 'ipsec') {
      await PolicyRuleToIPSecPrefix.moveToNewPosition(req);
    }

    res.status(204).end();
  } catch (error) {
    logger().error('Error updating policy_r__openvpn_prefix position: ' + JSON.stringify(error));
    res.status(400).json(error);
  }
});

/* Update ORDER de policy_r__interface that exist */
router.put('/:vpnType(openvpn|wireguard|ipsec)?/order', utilsModel.disableFirewallCompileStatus, (req, res) => { });

/* Remove policy_r__VPN_prefix */
router.put('/:vpnType(openvpn|wireguard|ipsec)?/del', utilsModel.disableFirewallCompileStatus, async (req, res) => {
  try {
    const vpnType = req.params.vpnType || req.prefix?.prefix_type;
    if (!vpnType) throw new Error('Tipo de VPN no reconocido');

    await ({
      openvpn: () => PolicyRuleToOpenVPNPrefix.deleteFromRulePosition(req),
      wireguard: () => PolicyRuleToWireGuardPrefix.deleteFromRulePosition(req),
      ipsec: () => PolicyRuleToIPSecPrefix.deleteFromRulePosition(req),
    }[vpnType])();

    res.status(204).end();
  } catch (error) {
    logger().error('Error removing policy_r__openvpn_prefix: ' + JSON.stringify(error));
    res.status(400).json(error);
  }
});

module.exports = router;
