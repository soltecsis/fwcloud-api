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


/**
 * Module to routing OpenVPN requests
 * <br>BASE ROUTE CALL: <b>/vpn/openvpn</b>
 *
 * @module OpenVPN
 * 
 * @requires express
 * @requires openvpnModel
 * 
 */

/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');
/**
 * Property  to manage  route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();


/**
 * Property Model to manage OpenVPN Data
 *
 * @property ClusterModel
 * @type ../../models/vpn/openvpn
 */

import { Crt } from '../../../models/vpn/pki/Crt';
import { OpenVPNPrefix } from '../../../models/vpn/openvpn/OpenVPNPrefix';
import { OpenVPN } from '../../../models/vpn/openvpn/OpenVPN';
import { Tree } from '../../../models/tree/Tree';
const restrictedCheck = require('../../../middleware/restricted');
import { IPObj } from '../../../models/ipobj/IPObj';
import { Channel } from '../../../sockets/channels/channel';
import {
	ProgressInfoPayload,
	ProgressNoticePayload,
	ProgressPayload,
	ProgressSuccessPayload
} from '../../../sockets/messages/socket-message';
import { logger } from '../../../fonaments/abstract-application';
import { Firewall, FirewallInstallCommunication } from '../../../models/firewall/Firewall';
import db from '../../../database/database-manager';
const fwcError = require('../../../utils/error_table');
import * as crypto from "crypto";
import { CCDComparer } from '../../../models/vpn/openvpn/ccd-comparer';
import { HttpException } from '../../../fonaments/exceptions/http/http-exception';
import { SSHCommunication } from '../../../communications/ssh.communication';
import { PgpHelper } from '../../../utils/pgp';
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

const OPENVPN_2FA_REQUIRED_OPTIONS = {
	verifyClientCert: { name: 'verify-client-cert', arg: 'require' },
	scriptSecurity: { name: 'script-security', arg: '2' },
	authUserPassOptional: { name: 'auth-user-pass-optional', arg: '' },
	authUserPassVerify: { name: 'auth-user-pass-verify', arg: '/etc/openvpn/bin/check_2fa.sh via-file' },
	setenvServerCn: { name: 'setenv' }
};

const queryDb = (dbCon, sql, params = []) => new Promise((resolve, reject) => {
	dbCon.query(sql, params, (error, result) => {
		if (error) {
			return reject(error);
		}
		resolve(result);
	});
});

const getOpenVPN2FATaskId = (firewallId) => `openvpn-2fa-firewall-${firewallId}`;

const getTargetFirewalls = async (firewall) => {
	if (!firewall.clusterId) {
		return [firewall];
	}

	return await db.getSource()
		.manager.getRepository(Firewall)
		.createQueryBuilder('firewall')
		.where('firewall.cluster = :clusterId', { clusterId: firewall.clusterId })
		.orderBy('firewall.fwmaster', 'DESC')
		.addOrderBy('firewall.id', 'ASC')
		.getMany();
};

const getCommunicationForFirewall = async (firewall, req) => {
	if (firewall.install_communication === FirewallInstallCommunication.SSH) {
		const pgp = new PgpHelper(req.session.pgp);
		return await firewall.getCommunication({
			sshuser: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
				? await pgp.decrypt(req.body.sshuser)
				: undefined,
			sshpassword: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
				? await pgp.decrypt(req.body.sshpass)
				: undefined,
		});
	}

	return await firewall.getCommunication();
};

const prepareOpenVPN2FATargets = async (req, targetFirewalls, channel, clusterName = null) => {
	const preparedTargets = [];
	const isClusterOperation = targetFirewalls.length > 1;

	for (const targetFirewall of targetFirewalls) {
		if (isClusterOperation) {
			emitOpenVPN2FANodeInfo(channel, `Checking communication with node '${targetFirewall.name}'`);
		}

		const communication = await getCommunicationForFirewall(targetFirewall, req);
		if (!communication) {
			throw fwcError.VPN_2FA_AGENT_REQUIRED;
		}

		await communication.ping();

		if (isClusterOperation) {
			channel.emit('message', new ProgressSuccessPayload('OK'));
		}

		preparedTargets.push({
			firewall: targetFirewall,
			communication
		});
	}

	return preparedTargets;
};

const emitOpenVPN2FANodeStart = (channel, firewall, enabled, clusterName = null) => {
	const action = enabled ? 'Enabling' : 'Disabling';
	const message = clusterName
		? `${action} OpenVPN 2FA on cluster '${clusterName}' node '${firewall.name}'`
		: `${action} OpenVPN 2FA on firewall '${firewall.name}'`;

	channel.emit('message', new ProgressPayload('start_task', false, message, getOpenVPN2FATaskId(firewall.id)));
};

const emitOpenVPN2FANodeEnd = (channel, firewall, enabled) => {
	channel.emit(
		'message',
		new ProgressSuccessPayload(
			enabled
				? `OpenVPN 2FA enabled successfully on '${firewall.name}'`
				: `OpenVPN 2FA disabled successfully on '${firewall.name}'`
		)
	);
	channel.emit('message', new ProgressPayload('end_task', false, '', getOpenVPN2FATaskId(firewall.id)));
};

const emitOpenVPN2FANodeNotice = (channel, message) => {
	channel.emit('message', new ProgressNoticePayload(message));
};

const emitOpenVPN2FANodeInfo = (channel, message) => {
	channel.emit('message', new ProgressInfoPayload(message));
};

const getOpenVPN2FAServerUsersFilename = (serverCN) => `${serverCN}_2fa_users.txt`;

const getOpenVPN2FASecretDir = (serverCN) => `/etc/openvpn/google-authenticator/${serverCN}`;

const getOpenVPN2FASecretFilename = (_serverCN, clientCN) => `${clientCN}`;

const getOpenVPNParentServerCN = async (dbCon, openvpnId, firewallId) => {
	const serverRows = await queryDb(
		dbCon,
		`SELECT crt.cn FROM openvpn
		INNER JOIN crt ON openvpn.crt = crt.id
		WHERE openvpn.id=?
		AND openvpn.firewall=?
		LIMIT 1`,
		[openvpnId, firewallId]
	);

	return serverRows?.[0]?.cn ?? null;
};

const getOpenVPN2FAUsersListContent = async (parentId, excludeOpenvpnId = null, includeClientCN = null) => {
	const query = db.getSource().manager.getRepository(OpenVPN)
		.createQueryBuilder('openvpn')
		.innerJoinAndSelect('openvpn.crt', 'crt')
		.where('openvpn.parentId = :parentId', { parentId })
		.andWhere('openvpn.tfa_enabled = 1');

	if (excludeOpenvpnId !== null && excludeOpenvpnId !== undefined) {
		query.andWhere('openvpn.id != :excludeOpenvpnId', { excludeOpenvpnId });
	}

	const enabledClients = await query.getMany();
	const clientNames = enabledClients.map(client => client.crt.cn);

	if (includeClientCN && !clientNames.includes(includeClientCN)) {
		clientNames.push(includeClientCN);
	}

	return clientNames.join('\n') + '\n';
};

const disableOpenVPNServer2FA = async (req, firewall, crt, clusterName = null) => {
	const targetFirewalls = await getTargetFirewalls(firewall);
	const serverUsersFilename = getOpenVPN2FAServerUsersFilename(crt.cn);
	const channel = await Channel.fromRequest(req);
	if (!targetFirewalls.length) {
		throw fwcError.VPN_2FA_AGENT_REQUIRED;
	}

	const hasClientsWith2FA = firewall.clusterId
		? await OpenVPN.clusterServerHasClientsWith2FAEnabled(
			req.dbCon,
			firewall.clusterId,
			req.body.openvpn
		)
		: await OpenVPN.firewallServerHasClientsWith2FAEnabled(
			req.dbCon,
			firewall.id,
			req.body.openvpn
		);

	if (hasClientsWith2FA) {
		throw fwcError.VPN_2FA_CLIENTS_ENABLED;
	}

	const hasOtherServersWith2FA = firewall.clusterId
		? await OpenVPN.clusterHasOtherServersWith2FAEnabled(
			req.dbCon,
			firewall.clusterId,
			req.body.openvpn
		)
		: await OpenVPN.firewallHasOtherServersWith2FAEnabled(
			req.dbCon,
			firewall.id,
			req.body.openvpn
		);

	await removeServer2FAOpenVPNOptions(req.dbCon, req.body.openvpn);
	const openvpnCfg = await OpenVPN.getCfg(req);
	const fwcloudId = firewall.fwCloudId ?? req.body.fwcloud;
	const cfgDump = await OpenVPN.dumpCfg(req.dbCon, fwcloudId, req.body.openvpn);
	if (!openvpnCfg.install_dir || !openvpnCfg.install_name) {
		throw fwcError.other('OpenVPN server install path or file name not found');
	}
	const preparedTargets = await prepareOpenVPN2FATargets(req, targetFirewalls, channel, clusterName);
	for (const { firewall: targetFirewall, communication } of preparedTargets) {
		emitOpenVPN2FANodeStart(channel, targetFirewall, false, clusterName);
		if (targetFirewall.install_communication === FirewallInstallCommunication.Agent) {
			emitOpenVPN2FANodeNotice(channel, `Removing OpenVPN 2FA runtime and server data for '${crt.cn}' on '${targetFirewall.name}'`);
			await communication.installPlugin('openvpn-2fa', false, channel, { serverCN: crt.cn });
		} else {
			if (!hasOtherServersWith2FA) {
				emitOpenVPN2FANodeNotice(channel, `Removing OpenVPN 2FA runtime from '${targetFirewall.name}'`);
				await communication.installPlugin('openvpn-2fa', false, channel);
			}
			emitOpenVPN2FANodeNotice(channel, `Removing OpenVPN 2FA secrets directory for server '${crt.cn}' on '${targetFirewall.name}'`);
			await communication.installPlugin('openvpn-2fa', false, channel, { serverCN: crt.cn });
			emitOpenVPN2FANodeNotice(channel, `Removing OpenVPN 2FA users file '${serverUsersFilename}' from '${targetFirewall.name}'`);
			await communication.uninstallOpenVPNConfigs('/etc/openvpn', [serverUsersFilename], channel);
		}
		emitOpenVPN2FANodeNotice(channel, `Updating OpenVPN server configuration '${openvpnCfg.install_name}' on '${targetFirewall.name}'`);
		await communication.installOpenVPNServerConfigs(openvpnCfg.install_dir, [{
			content: cfgDump.cfg,
			name: openvpnCfg.install_name
		}], channel);
		emitOpenVPN2FANodeEnd(channel, targetFirewall, false);
	}

	await queryDb(
		req.dbCon,
		'UPDATE openvpn SET tfa_enabled=0, installed_at=NOW(), updated_at=NOW() WHERE id=?',
		[req.body.openvpn]
	);

	await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "&~1");
};

const uninstallOpenVPNServerConfig = async (req, firewall) => {
	const targetFirewalls = await getTargetFirewalls(firewall);
	const channel = await Channel.fromRequest(req);

	if (!targetFirewalls.length) {
		throw fwcError.VPN_2FA_AGENT_REQUIRED;
	}

	if (!req.openvpn.install_dir || !req.openvpn.install_name) {
		throw { 'msg': 'Empty install dir or install name' };
	}

	for (const targetFirewall of targetFirewalls) {
		const communication = await getCommunicationForFirewall(targetFirewall, req);
		if (!communication) {
			throw fwcError.VPN_2FA_AGENT_REQUIRED;
		}

		emitOpenVPN2FANodeNotice(channel, `Removing OpenVPN server configuration '${req.openvpn.install_name}' from '${targetFirewall.name}'`);
		await communication.uninstallOpenVPNConfigs(req.openvpn.install_dir, [req.openvpn.install_name], channel);
	}
};

const disableOpenVPNClient2FA = async (req, firewall, crt, clusterName = null) => {
	const targetFirewalls = await getTargetFirewalls(firewall);
	if (!targetFirewalls.length) {
		throw fwcError.VPN_2FA_AGENT_REQUIRED;
	}

	if (!req.openvpn.openvpn) {
		throw fwcError.other('OpenVPN client has no parent server');
	}

	const serverCN = await getOpenVPNParentServerCN(req.dbCon, req.openvpn.openvpn, firewall.id);
	if (!serverCN) {
		throw fwcError.other('OpenVPN parent server not found');
	}

	const channel = await Channel.fromRequest(req);
	const usersListContent = await getOpenVPN2FAUsersListContent(req.openvpn.openvpn, req.body.openvpn);
	const preparedTargets = await prepareOpenVPN2FATargets(req, targetFirewalls, channel, clusterName);
	for (const { firewall: targetFirewall, communication } of preparedTargets) {
		emitOpenVPN2FANodeStart(channel, targetFirewall, false, clusterName);
		try {
			emitOpenVPN2FANodeNotice(channel, `Removing OpenVPN 2FA secret for client '${crt.cn}' from '${targetFirewall.name}'`);
			await communication.uninstallOpenVPNConfigs(
				getOpenVPN2FASecretDir(serverCN),
				[getOpenVPN2FASecretFilename(serverCN, crt.cn)],
				channel
			);
		} catch (error) {
			if (!error?.message || error.message.indexOf('Directory not found') === -1) {
				throw error;
			}
		}
		emitOpenVPN2FANodeNotice(channel, `Updating OpenVPN 2FA users list '${getOpenVPN2FAServerUsersFilename(serverCN)}' on '${targetFirewall.name}'`);
		await communication.installOpenVPNServerConfigs('/etc/openvpn', [{
			name: getOpenVPN2FAServerUsersFilename(serverCN),
			content: usersListContent
		}], channel);
		emitOpenVPN2FANodeEnd(channel, targetFirewall, false);
	}

	await removeClient2FAOpenVPNOptions(req.dbCon, req.body.openvpn);
	await new Promise((resolve, reject) => {
		req.dbCon.query(
			`UPDATE openvpn SET tfa_enabled=0, installed_at=NOW(), updated_at=NOW() WHERE id=${req.dbCon.escape(req.body.openvpn)}`,
			(error, result) => {
				if (error) return reject(error);
				resolve(result);
			}
		);
	});

	await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "&~1");
};

const ensureServer2FAOpenVPNOptions = async (dbCon, openvpnId, serverCN) => {
	const options = await queryDb(
		dbCon,
		'SELECT id,name,arg,scope,comment,`order`,ipobj FROM openvpn_opt WHERE openvpn=? ORDER BY `order` ASC,id ASC',
		[openvpnId]
	);

	const findOption = (matcher) => options.find(matcher);

	const ensureOption = async ({ name, arg, matcher = null }) => {
		const existingOption = matcher
			? findOption(matcher)
			: findOption((option) => option.name === name);
		if (existingOption) {
			if (existingOption.arg !== arg || existingOption.comment !== null) {
				await queryDb(
					dbCon,
					'UPDATE openvpn_opt SET arg=?, comment=NULL WHERE id=?',
					[arg, existingOption.id]
				);
			}
			return;
		}

		const maxOrder = options.reduce((max, option) => Math.max(max, option.order || 0), 0);
		await queryDb(
			dbCon,
			'INSERT INTO openvpn_opt SET ?',
			[{
				openvpn: openvpnId,
				name,
				arg,
				scope: 1,
				order: maxOrder + 1,
				comment: null,
				ipobj: null
			}]
		);
		options.push({
			name,
			arg,
			scope: 1,
			order: maxOrder + 1
		});
	};

	await ensureOption(OPENVPN_2FA_REQUIRED_OPTIONS.verifyClientCert);
	await ensureOption(OPENVPN_2FA_REQUIRED_OPTIONS.scriptSecurity);
	await ensureOption(OPENVPN_2FA_REQUIRED_OPTIONS.authUserPassOptional);
	await ensureOption(OPENVPN_2FA_REQUIRED_OPTIONS.authUserPassVerify);
	await ensureOption({
		name: OPENVPN_2FA_REQUIRED_OPTIONS.setenvServerCn.name,
		arg: `SERVER_CN ${serverCN}`,
		matcher: (option) => option.name === 'setenv' && typeof option.arg === 'string' && option.arg.startsWith('SERVER_CN ')
	});
};

const removeServer2FAOpenVPNOptions = async (dbCon, openvpnId) => {
	await queryDb(
		dbCon,
		`DELETE FROM openvpn_opt
		 WHERE openvpn=?
			 AND (
			 name=?
			 OR name=?
			 OR name=?
			 OR name=?
			 OR (name=? AND arg LIKE ?)
			 )`,
		[
			openvpnId,
			OPENVPN_2FA_REQUIRED_OPTIONS.verifyClientCert.name,
			OPENVPN_2FA_REQUIRED_OPTIONS.scriptSecurity.name,
			OPENVPN_2FA_REQUIRED_OPTIONS.authUserPassOptional.name,
			OPENVPN_2FA_REQUIRED_OPTIONS.authUserPassVerify.name,
			OPENVPN_2FA_REQUIRED_OPTIONS.setenvServerCn.name,
			'SERVER_CN %'
		]
	);
};

const ensureClient2FAOpenVPNOptions = async (dbCon, openvpnId, clientCN) => {
	const options = await queryDb(
		dbCon,
		'SELECT id,name,arg,scope,comment,`order`,ipobj FROM openvpn_opt WHERE openvpn=? ORDER BY `order` ASC,id ASC',
		[openvpnId]
	);

	const existingOption = options.find((option) => option.name === 'auth-user-pass');
	if (existingOption) {
		if (existingOption.arg !== clientCN || existingOption.comment !== null) {
			await queryDb(
				dbCon,
				'UPDATE openvpn_opt SET arg=?, comment=NULL WHERE id=?',
				[clientCN, existingOption.id]
			);
		}
		return;
	}

	const maxOrder = options.reduce((max, option) => Math.max(max, option.order || 0), 0);
	await queryDb(
		dbCon,
		'INSERT INTO openvpn_opt SET ?',
		[{
			openvpn: openvpnId,
			name: 'auth-user-pass',
			arg: clientCN,
			scope: 1,
			order: maxOrder + 1,
			comment: null,
			ipobj: null
		}]
	);
};

const removeClient2FAOpenVPNOptions = async (dbCon, openvpnId) => {
	await queryDb(
		dbCon,
		'DELETE FROM openvpn_opt WHERE openvpn=? AND name=?',
		[openvpnId, 'auth-user-pass']
	);
};

const buildClient2FASecretFile = (secret) => {
	return [
		secret.base32,
		'" TOTP_AUTH',
		'" WINDOW_SIZE 3',
		'" DISALLOW_REUSE',
		'" RATE_LIMIT 3 30'
	].join('\n');
};

/**
 * Create a new OpenVPN configuration in firewall.
 */
router.post('/', async (req, res) => {
	try {
		// Verify that the node tree type is correct.
		if (req.tree_node.node_type !== 'OPN' && req.tree_node.node_type !== 'OSR')
			throw fwcError.BAD_TREE_NODE_TYPE;

		// Verify that the OpenVPN configuration is the same indicated in the tree node.
		if (req.body.openvpn && req.body.openvpn != req.tree_node.id_obj)
			throw { 'msg': 'Information in node tree and in API request don\'t match' };

		// Verify that we are using the correct type of certificate.
		// 1=Client certificate, 2=Server certificate.
		if (req.crt.type === 1 && !req.body.openvpn)
			throw { 'msg': 'When using client certificates you must indicate the OpenVPN server configuration' };
		if (req.crt.type === 2 && req.body.openvpn)
			throw { 'msg': 'When using server certificates you must not indicate the OpenVPN server configuration' };

		// The client certificate for a new OpenVPN client configuration must belong to the same CA
		// that the OpenVPN server configuration to which we are vinculationg this new client VPN.
		if (req.crt.type === 1 && req.crt.ca !== req.openvpn.ca)
			throw { 'msg': 'CRT for a new client OpenVPN configuration must has the same CA that the server OpenVPN configuration to which it belongs' };

		// The firewall id for the new OpenVPN client configuration must be the same firewall id of
		// the server OpenVPN configuration.
		if (req.crt.type === 1 && req.body.firewall !== req.openvpn.firewall)
			throw { 'msg': 'Firewall ID for the new client OpenVPN configuration must match server OpenVPN configuration' };

		const newOpenvpn = await OpenVPN.addCfg(req);

		// Now create all the options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = newOpenvpn;
			opt.order = order++;
			await OpenVPN.addCfgOpt(req, opt);
		}

		// Create the OpenVPN configuration node in the tree.
		let nodeId;
		if (req.tree_node.node_type === 'OPN') // This will be an OpenVPN server configuration.
			nodeId = await Tree.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OSR', newOpenvpn, 312);
		else if (req.tree_node.node_type === 'OSR') { // This will be an OpenVPN client configuration.
			//nodeId = await fwc_treeModel.newNode(req.dbCon, req.body.fwcloud, req.crt.cn, req.body.node_id, 'OCL', cfg, 311);
			await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon, req.body.fwcloud, req.body.openvpn);

			// Update the compilation status of all the firewalls that use the VPN Prefixes to which this new OpenVPN
			// connection will belong.
			await OpenVPNPrefix.updateOpenvpnClientPrefixesFWStatus(req.dbCon, req.body.fwcloud, newOpenvpn);
		}

		// If we are creaing an OpenVPN server configuration, then create the VPN virtual network interface with its assigned IP.
		if (req.crt.type === 2) // 1=Client certificate, 2=Server certificate.
			await OpenVPN.createOpenvpnServerInterface(req, newOpenvpn);

		res.status(200).json({ insertId: newOpenvpn, TreeinsertId: nodeId });
	} catch (error) {
		logger().error('Error creating a new openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Update configuration options.
 */
router.put('/', async (req, res) => {
	try {
		await OpenVPN.updateCfg(req);

		const currentOptions = await OpenVPN.getCfg(req).then(data => data.options);
		// First remove all the current configuration options.
		await OpenVPN.delCfgOptAll(req);

		// Now create all the new options for the OpenVPN configuration.
		var order = 1;
		for (let opt of req.body.options) {
			opt.openvpn = req.body.openvpn;
			opt.order = order++;
			await OpenVPN.addCfgOpt(req, opt);
		}

		// Update the status flag if any option changed (any scope).
		const formatOptions = (options = []) => options
			.map(opt => ({
				name: opt.name ?? null,
				arg: opt.arg ?? opt.value ?? null,
				ipobj: opt.ipobj ?? null,
				scope: opt.scope ?? null,
				comment: opt.comment ?? null,
				order: opt.order ?? null,
			}))
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.name || '').localeCompare(b.name || ''));

		const hasOptionsChanged =
			JSON.stringify(formatOptions(currentOptions)) !== JSON.stringify(formatOptions(req.body.options));

		if (hasOptionsChanged) {
			await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "|1");
		}

		res.status(204).end();
	} catch (error) {
		logger().error('Error updating an openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration data.
 */
router.put('/get', async (req, res) => {
	try {
		const data = await OpenVPN.getCfg(req);
		res.status(200).json(data);
	} catch (error) {
		logger().error('Error getting an openvpn: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration files.
 */
router.put('/file/get', async (req, res) => {
	try {
		const cfgDump = await OpenVPN.dumpCfg(req.dbCon, req.body.fwcloud, req.body.openvpn);
		res.status(200).json(cfgDump);
	} catch (error) {
		logger().error('Error getting openvpn configuration: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN ipobj data.
 */
router.put('/ipobj/get', async (req, res) => {
	try {
		const cfgData = await OpenVPN.getCfg(req);
		let data = [];
		for (let openvpn_opt of cfgData.options) {
			if (openvpn_opt.ipobj)
				data.push(await IPObj.getIpobjInfo(req.dbCon, req.body.fwcloud, openvpn_opt.ipobj));
		}
		res.status(200).json(data);
	} catch (error) {
		logger().error('Error getting openvpn ipobj: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get next VPN LAN free IP.
 */
router.put('/ip/get', async (req, res) => {
	try {
		const freeIP = await OpenVPN.freeVpnIP(req);
		res.status(200).json(freeIP);
	} catch (error) {
		logger().error('Error getting openvpn free ip: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN configuration metadata.
 */
router.put('/info/get', async (req, res) => {
	try {
		const data = await OpenVPN.getOpenvpnInfo(req.dbCon, req.body.fwcloud, req.body.openvpn, req.openvpn.type);
		res.status(200).json(data[0]);
	} catch (error) {
		logger().error('Error getting openvpn metadata: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Get OpenVPN server's data under given firewall.
 */
router.put('/firewall/get', async (req, res) => {
	try {
		const data = await OpenVPN.getOpenvpnServersByFirewall(req.dbCon, req.body.firewall);
		res.status(200).json(data);
	} catch (error) {
		logger().error('Error getting openvpn firewall data: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Delete OpenVPN configuration.
 */
router.put('/del',
	restrictedCheck.openvpn,
	async (req, res) => {
		try {
			if (req.openvpn.type !== 1 && Number(req.openvpn.tfa_enabled) === 1) {
				const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
					where: { id: req.openvpn.firewall }
				});
				await disableOpenVPNServer2FA(req, firewall, req.openvpn);
				await uninstallOpenVPNServerConfig(req, firewall);
			} else if (req.openvpn.type === 1 && Number(req.openvpn.tfa_enabled) === 1) {
				const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
					where: { id: req.openvpn.firewall }
				});
				const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
				await disableOpenVPNClient2FA(req, firewall, crt);
			}

			// Update the compilation status of all the firewalls that use the VPN Prefixes to which this OpenVPN
			// connection belongs. It must be done before the OpenVPN deletion.
			if (req.openvpn.type === 1) await OpenVPNPrefix.updateOpenvpnClientPrefixesFWStatus(req.dbCon, req.body.fwcloud, req.body.openvpn);

			// Delete the configuration from de database.
			await OpenVPN.delCfg(req.dbCon, req.body.fwcloud, req.body.openvpn);

			if (req.openvpn.type === 1) { // Client OpenVPN configuration.
				// Regenerate the tree under the OpenVPN server to which the client OpenVPN configuration belongs.
				// This is necesary for avoid empty prefixes if we remove all the OpenVPN client configurations for a prefix.
				await OpenVPNPrefix.applyOpenVPNPrefixes(req.dbCon, req.body.fwcloud, req.openvpn.openvpn);

			} else { // Server OpenVPN configuration.
				// Delete the openvpn node from the tree.
				await Tree.deleteObjFromTree(req.body.fwcloud, req.body.openvpn, 312);
			}

			res.status(204).end();
		} catch (error) {
			logger().error('Error removing openvpn: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
	});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.openvpn, (req, res) => res.status(204).end());


router.put('/where', async (req, res) => {
	try {
		const data = await OpenVPN.searchOpenvpnUsage(req.dbCon, req.body.fwcloud, req.body.openvpn, true);
		if (data.result > 0)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch (error) {
		logger().error('Error getting openvpn references: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});


/**
 * Install OpenVPN configuration in the destination firewall.
 */
router.put('/install', async (req, res, next) => {
	try {
		const channel = await Channel.fromRequest(req);
		const cfgDump = await OpenVPN.dumpCfg(req.dbCon, req.body.fwcloud, req.body.openvpn);
		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({ where: { id: req.body.firewall } });

		let communication;
		if (firewall.install_communication === FirewallInstallCommunication.SSH) {
			const pgp = new PgpHelper(req.session.pgp);
			communication = new SSHCommunication({
				host: (
					await db
						.getSource()
						.manager.getRepository(IPObj)
						.findOneOrFail({ where: { id: firewall.install_ipobj } })
				).address,
				port: firewall.install_port,
				username: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
					? await pgp.decrypt(req.body.sshuser)
					: await pgp.decrypt(firewall.install_user),
				password: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
					? await pgp.decrypt(req.body.sshpass)
					: await pgp.decrypt(firewall.install_pass),
				options: null,
			});
		} else {
			communication = await firewall.getCommunication();
		}

		channel.emit('message', new ProgressPayload('start', false, 'Installing OpenVPN'));

		// Next we have to activate the OpenVPN configuration in the destination firewall/cluster.
		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await OpenVPN.getOptData(req.dbCon, req.openvpn.openvpn, 'client-config-dir');
			if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
			await communication.installOpenVPNClientConfigs(openvpn_opt.arg, [{
				content: cfgDump.ccd,
				name: crt.cn
			}], channel);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw { 'msg': 'Empty install dir or install name' };
			await communication.installOpenVPNServerConfigs(req.openvpn.install_dir, [{
				content: cfgDump.cfg,
				name: req.openvpn.install_name
			}], channel);
		}

		// Update the status flag for the OpenVPN configuration.
		await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "&~1");

		// Update the install date.
		await OpenVPN.updateOpenvpnInstallDate(req.dbCon, req.body.openvpn);

		channel.emit('message', new ProgressPayload('end', false, 'Installing OpenVPN'));
		res.status(200).send();
	} catch (error) {
		logger().error('Error installing openvpn: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});


/**
 * Uninstall OpenVPN configuration from the destination firewall.
 */
router.put('/uninstall', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({ where: { id: req.body.firewall } });
		const channel = await Channel.fromRequest(req);
		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		let communication;
		if (firewall.install_communication === FirewallInstallCommunication.SSH) {
			const pgp = new PgpHelper(req.session.pgp);
			communication = new SSHCommunication({
				host: (
					await db
						.getSource()
						.manager.getRepository(IPObj)
						.findOneOrFail({ where: { id: firewall.install_ipobj } })
				).address,
				port: firewall.install_port,
				username: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
					? await pgp.decrypt(req.body.sshuser)
					: await pgp.decrypt(firewall.install_user),
				password: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
					? await pgp.decrypt(req.body.sshpass)
					: await pgp.decrypt(firewall.install_pass),
				options: null,
			});
		} else {
			communication = await firewall.getCommunication();
		}

		if (crt.type !== 1 && Number(req.openvpn.tfa_enabled) === 1) {
			const clusterName = req.body.cluster_name || req.body.parent_name || null;
			await disableOpenVPNServer2FA(req, firewall, crt, clusterName);
		} else if (crt.type === 1 && Number(req.openvpn.tfa_enabled) === 1) {
			const clusterName = req.body.cluster_name || req.body.parent_name || null;
			await disableOpenVPNClient2FA(req, firewall, crt, clusterName);
		}

		channel.emit('message', new ProgressPayload('start', false, 'Uninstalling OpenVPN'));

		if (crt.type === 1) { // Client certificate
			// Obtain de configuration directory in the client-config-dir configuration option.
			// req.openvpn.openvpn === ID of the server's OpenVPN configuration to which this OpenVPN client config belongs.
			const openvpn_opt = await OpenVPN.getOptData(req.dbCon, req.openvpn.openvpn, 'client-config-dir');
			if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_CFGDIR;
			await communication.uninstallOpenVPNConfigs(openvpn_opt.arg, [crt.cn], channel);
		}
		else { // Server certificate
			if (!req.openvpn.install_dir || !req.openvpn.install_name)
				throw { 'msg': 'Empty install dir or install name' };
			await communication.uninstallOpenVPNConfigs(req.openvpn.install_dir, [req.openvpn.install_name], channel);
		}

		// Update the status flag for the OpenVPN configuration.
		await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "|1");

		channel.emit('message', new ProgressPayload('end', false, 'Uninstalling OpenVPN'));

		res.status(200).send().end();
	} catch (error) {
		logger().error('Error uninstalling openvpn: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});

/**
 * Sync all CCD file configurations.
 * Remove first all the server CCD files and then install all the CCD files.
 * ROUTE CALL:  /vpn/openvpn/ccdsync
 */
router.put('/ccdsync', async (req, res, next) => {
	try {
		const channel = await Channel.fromRequest(req);
		const firewall = await db.getSource().manager.getRepository(Firewall).createQueryBuilder('firewall')
			.where('firewall.id = :firewallId', { firewallId: req.body.firewall })
			.andWhere('firewall.fwCloudId = :fwcloudId', { fwcloudId: req.body.fwcloud })
			.getOneOrFail();
		const openvpnQuery = db.getSource().manager.getRepository(OpenVPN).createQueryBuilder('openvpn')
			.innerJoinAndSelect('openvpn.crt', 'crt')
			.innerJoin('openvpn.firewall', 'firewall')
			.where('openvpn.id = :openvpnId', { openvpnId: req.body.openvpn })
			.andWhere('firewall.fwCloudId = :fwcloudId', { fwcloudId: req.body.fwcloud });

		// If the firewall belongs to a cluster we must get the openvpn assigned to the master
		// firewall. Otherwise, we must get the openvpn assigned to the firewall defined in the request
		if (firewall.clusterId) {
			openvpnQuery
				.andWhere('firewall.cluster = :cluster', { cluster: firewall.clusterId })
				.andWhere('firewall.fwmaster = 1');
		} else {
			openvpnQuery.andWhere('firewall.id = :firewallId', { firewallId: req.body.firewall })
		}


		//If the firewall belongs to a cluster, openvpn will belong to the master node of the cluster
		const openvpn = await openvpnQuery.getOneOrFail();

		const cluster = await Firewall.getClusterId(req.dbCon, req.body.firewall);
		let lastClusterNodeId = cluster ? await Firewall.getLastClusterNodeId(req.dbCon, cluster) : null;

		// This action only can be done in server OpenVPN configurations.
		if (openvpn.crt.type !== 2) {
			throw fwcError.VPN_NOT_SER;
		}

		// Obtain the configuration directory in the client-config-dir configuration option of the OpenVPN
		// server configuration.
		const openvpn_opt = await OpenVPN.getOptData(req.dbCon, req.body.openvpn, 'client-config-dir');
		if (!openvpn_opt) {
			throw fwcError.VPN_NOT_FOUND_CFGDIR;
		}
		const client_config_dir = openvpn_opt.arg;

		// Get all client configurations for this OpenVPN server configuration.
		const clients = await db.getSource().manager.getRepository(OpenVPN).createQueryBuilder('openvpn')
			.innerJoinAndSelect('openvpn.crt', 'crt')
			.where('openvpn.parentId = :parentId', { parentId: openvpn.id })
			.getMany();

		let communication;
		if (firewall.install_communication === FirewallInstallCommunication.SSH) {
			const pgp = new PgpHelper(req.session.pgp);
			communication = new SSHCommunication({
				host: (
					await db
						.getSource()
						.manager.getRepository(IPObj)
						.findOneOrFail({ where: { id: firewall.install_ipobj } })
				).address,
				port: firewall.install_port,
				username: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
					? await pgp.decrypt(req.body.sshuser)
					: await pgp.decrypt(firewall.install_user),
				password: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
					? await pgp.decrypt(req.body.sshpass)
					: await pgp.decrypt(firewall.install_pass),
				options: null,
			});
		} else {
			communication = await firewall.getCommunication();
		}
		const ccdRemoteHashes = await communication.ccdHashList(client_config_dir, channel);
		const ccdLocalHashes = [];
		for (let client of clients) {
			let cfgDump = await OpenVPN.dumpCfg(db.getQuery(), req.body.fwcloud, client.id);

			//We must remove comment from ccd before generate the hash
			const ccdContent = cfgDump.ccd;
			const ccdName = client.crt.cn;
			const hash = crypto.createHash('sha256');
			hash.update(ccdContent);
			const digest = hash.digest('hex');

			ccdLocalHashes.push({
				filename: ccdName,
				hash: digest
			});
		}
		const compare = CCDComparer.compare(ccdLocalHashes, ccdRemoteHashes);

		// Unsynced and onlyLocal certificates must be installed
		const toBeInstalled = [].concat(compare.onlyLocal, compare.unsynced);
		if (toBeInstalled.length > 0) {
			let communication;
			if (firewall.install_communication === FirewallInstallCommunication.SSH) {
				const pgp = new PgpHelper(req.session.pgp);
				communication = new SSHCommunication({
					host: (
						await db
							.getSource()
							.manager.getRepository(IPObj)
							.findOneOrFail({ where: { id: firewall.install_ipobj } })
					).address,
					port: firewall.install_port,
					username: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
						? await pgp.decrypt(req.body.sshuser)
						: await pgp.decrypt(firewall.install_user),
					password: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
						? await pgp.decrypt(req.body.sshpass)
						: await pgp.decrypt(firewall.install_pass),
					options: null,
				});
			} else {
				communication = await firewall.getCommunication();
			}
			const toBeInstalledOpenVPNs = await db.getSource().manager.getRepository(OpenVPN).createQueryBuilder('openvpn')
				.innerJoinAndSelect('openvpn.crt', 'crt')
				.where('openvpn.parentId = :openvpn', { openvpn: openvpn.id })
				.andWhere('crt.cn IN (:...names)', { names: toBeInstalled })
				.getMany();

			while (toBeInstalledOpenVPNs.length > 0) {
				const clients = toBeInstalledOpenVPNs.splice(0, 10);
				const options = []
				for (let client of clients) {
					let cfgDump = await OpenVPN.dumpCfg(db.getQuery(), req.body.fwcloud, client.id);
					options.push({
						name: client.crt.cn,
						content: cfgDump.ccd
					});
				}
				await communication.installOpenVPNClientConfigs(client_config_dir, options, channel);
			}
		}

		//onlyRemote certificates must be uninstalled
		const toBeUnInstalled = compare.onlyRemote;
		if (toBeUnInstalled.length > 0) {
			let communication;
			if (firewall.install_communication === FirewallInstallCommunication.SSH) {
				const pgp = new PgpHelper(req.session.pgp);
				communication = new SSHCommunication({
					host: (
						await db
							.getSource()
							.manager.getRepository(IPObj)
							.findOneOrFail({ where: { id: firewall.install_ipobj } })
					).address,
					port: firewall.install_port,
					username: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
						? await pgp.decrypt(req.body.sshuser)
						: await pgp.decrypt(firewall.install_user),
					password: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
						? await pgp.decrypt(req.body.sshpass)
						: await pgp.decrypt(firewall.install_pass),
					options: null,
				});
			} else {
				communication = await firewall.getCommunication();
			}
			await communication.uninstallOpenVPNConfigs(client_config_dir, toBeUnInstalled, channel);
		}

		for (let client of clients) {
			// Update the status flag for the OpenVPN configuration.
			// In a cluster update only if this is the last cluster node.
			if (!cluster || req.body.firewall === lastClusterNodeId) {
				await OpenVPN.updateOpenvpnStatus(req.dbCon, client.id, "&~1");
			}
		}

		channel.emit('message', new ProgressPayload('end', false, 'Sync OpenVPN CCD'));

		res.status(200).send().end();
	} catch (error) {
		logger().error('Error openvpn ccd sync: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});


/**
 * Get the OpenVPN server status log file.
 */
router.put('/status/get', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).createQueryBuilder('firewall')
			.where(`firewall.id = :id`, { id: req.body.firewall })
			.andWhere(`firewall.fwCloudId = :fwcloud`, { fwcloud: req.body.fwcloud })
			.getOneOrFail();
		let communication = null;

		if (firewall.install_communication === FirewallInstallCommunication.SSH) {
			communication = new SSHCommunication({
				host: Object.prototype.hasOwnProperty.call(req.body, "host") ? req.body.host : (await db.getSource().manager.getRepository(IPObj).findOneOrFail({ where: { id: firewall.install_ipobj } })).address,
				port: Object.prototype.hasOwnProperty.call(req.body, "port") ? req.body.port : firewall.install_port,
				username: Object.prototype.hasOwnProperty.call(req.body, "sshuser") ? req.body.sshuser : utilsModel.decrypt(firewall.install_user),
				password: Object.prototype.hasOwnProperty.call(req.body, "sshpass") ? req.body.sshpass : utilsModel.decrypt(firewall.install_pass),
				options: null
			});
		} else {
			communication = await firewall.getCommunication();
		}


		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;

		// Obtain the status log file option of the OpenVPN server configuration.
		const openvpn_opt = await OpenVPN.getOptData(req.dbCon, req.body.openvpn, 'status');
		if (!openvpn_opt) throw fwcError.VPN_NOT_FOUND_STATUS;
		const status_file_path = openvpn_opt.arg;

		const data = await communication.getRealtimeStatus(status_file_path);

		res.status(200).json(data);
	} catch (error) {
		logger().error('Error getting openvpn log file: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});

router.put('/2fa/server/enabled', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
			where: { id: req.body.firewall }
		});

		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;
				
		const hasEnabledServers = firewall.clusterId
			? await OpenVPN.clusterHasOtherServersWith2FAEnabled(
				req.dbCon,
				firewall.clusterId,
				req.body.openvpn
			)
			: await OpenVPN.firewallHasOtherServersWith2FAEnabled(
				req.dbCon,
				firewall.id,
				req.body.openvpn
			);

		res.status(200).json({ enabled: hasEnabledServers });
	} catch (error) {
		logger().error('Error checking openvpn 2fa enabled server data: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});


router.put('/2fa/server/clients/enabled', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
			where: { id: req.body.firewall }
		});

		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;
				
		const hasEnabledClients = firewall.clusterId
			? await OpenVPN.clusterServerHasClientsWith2FAEnabled(
				req.dbCon,
				firewall.clusterId,
				req.body.openvpn
			)
			: await OpenVPN.firewallServerHasClientsWith2FAEnabled(
				req.dbCon,
				firewall.id,
				req.body.openvpn
			);

		res.status(200).json({ enabled: hasEnabledClients });
	} catch (error) {
		logger().error('Error checking openvpn 2fa enabled clients data: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});


router.put('/2fa/server', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
			where: { id: req.body.firewall }
		});
		const clusterName = req.body.cluster_name || req.body.parent_name || null;
		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		if (crt.type !== 2) // This action only can be done in server OpenVPN configurations.
			throw fwcError.VPN_NOT_SER;

		const enabled = !!req.body.enabled;

		if (!enabled) {
			await disableOpenVPNServer2FA(req, firewall, crt, clusterName);
		} else {
			const targetFirewalls = await getTargetFirewalls(firewall);
			const serverUsersFilename = getOpenVPN2FAServerUsersFilename(crt.cn);
			const channel = await Channel.fromRequest(req);
			if (!targetFirewalls.length) {
				throw fwcError.VPN_2FA_AGENT_REQUIRED;
			}

			// Check if any other server has 2FA enabled. If not, we must install the plugin before enable 2FA in this server.
			const hasOtherServersWith2FA = firewall.clusterId
				? await OpenVPN.clusterHasOtherServersWith2FAEnabled(
					req.dbCon,
					firewall.clusterId,
					req.body.openvpn
				)
				: await OpenVPN.firewallHasOtherServersWith2FAEnabled(
					req.dbCon,
					firewall.id,
					req.body.openvpn
				);

			if (!hasOtherServersWith2FA) {
				// Plugin installation will be performed together with the config update in the per-node loop below.
			}

			// Ensure OpenVPN server has all directives required by certificate + TOTP script authentication.
			await ensureServer2FAOpenVPNOptions(req.dbCon, req.body.openvpn, crt.cn);

			// Apply the generated server.conf right now. If this fails, we don't enable 2FA in database.
			const openvpnCfg = await OpenVPN.getCfg(req);
			const fwcloudId = firewall.fwCloudId ?? req.body.fwcloud;
			const cfgDump = await OpenVPN.dumpCfg(req.dbCon, fwcloudId, req.body.openvpn);
			if (!openvpnCfg.install_dir || !openvpnCfg.install_name) {
				throw fwcError.other('OpenVPN server install path or file name not found');
			}
			const preparedTargets = await prepareOpenVPN2FATargets(req, targetFirewalls, channel, clusterName);
			for (const { firewall: targetFirewall, communication: targetCommunication } of preparedTargets) {
				emitOpenVPN2FANodeStart(channel, targetFirewall, enabled, clusterName);
				if (targetFirewall.install_communication === FirewallInstallCommunication.Agent) {
					emitOpenVPN2FANodeNotice(channel, `Installing OpenVPN 2FA runtime and server data for '${crt.cn}' on '${targetFirewall.name}'`);
					await targetCommunication.installPlugin('openvpn-2fa', true, channel, { serverCN: crt.cn });
				} else {
					if (!hasOtherServersWith2FA) {
						emitOpenVPN2FANodeNotice(channel, `Installing OpenVPN 2FA runtime on '${targetFirewall.name}'`);
						await targetCommunication.installPlugin('openvpn-2fa', true, channel);
					}
					emitOpenVPN2FANodeNotice(channel, `Creating OpenVPN 2FA users file '${serverUsersFilename}' on '${targetFirewall.name}'`);
					await targetCommunication.installOpenVPNServerConfigs('/etc/openvpn', [{
						content: '',
						name: serverUsersFilename
					}], channel);
				}
				emitOpenVPN2FANodeNotice(channel, `Updating OpenVPN server configuration '${openvpnCfg.install_name}' on '${targetFirewall.name}'`);
				await targetCommunication.installOpenVPNServerConfigs(openvpnCfg.install_dir, [{
					content: cfgDump.cfg,
					name: openvpnCfg.install_name
				}], channel);
				emitOpenVPN2FANodeEnd(channel, targetFirewall, enabled);
			}
		}

		if (enabled) {
			await new Promise((resolve, reject) => {
				req.dbCon.query(
					`UPDATE openvpn SET tfa_enabled=${req.dbCon.escape(1)}, installed_at=NOW(), updated_at=NOW() WHERE id=${req.dbCon.escape(req.body.openvpn)}`,
					(error, result) => {
						if (error) return reject(error);
						resolve(result);
					}
				);
			});

			await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "&~1");
		}

		res.status(204).end();
	} catch (error) {
		logger().error('Error getting openvpn 2fa server data: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}
		
		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});

router.put('/2fa/client', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
			where: { id: req.body.firewall }
		});
		const targetFirewalls = await getTargetFirewalls(firewall);
		const clusterName = req.body.cluster_name || req.body.parent_name || null;
		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		if (crt.type !== 1) // This action only can be done in client OpenVPN configurations.
			throw fwcError.VPN_NOT_CLI;

		if (!req.openvpn.openvpn) {
			throw fwcError.other('OpenVPN client has no parent server');
		}

		if (!targetFirewalls.length) {
			throw fwcError.VPN_2FA_AGENT_REQUIRED;
		}

		const enabled = !!req.body.enabled;
		let totpData = null;

		if (enabled) {
			const sql = `SELECT tfa_enabled FROM openvpn WHERE id=${req.dbCon.escape(req.openvpn.openvpn)}
				AND firewall=${req.dbCon.escape(firewall.id)}`;
			const result = await new Promise((resolve, reject) => {
				req.dbCon.query(sql, (error, rows) => {
					if (error) return reject(error);
					resolve(rows);
				});
			});

			if (!result || result.length === 0 || result[0].tfa_enabled !== 1) {
				throw fwcError.VPN_2FA_SERVER_DISABLED;
			}

			const serverCN = await getOpenVPNParentServerCN(req.dbCon, req.openvpn.openvpn, firewall.id);
			if (!serverCN) {
				throw fwcError.other('OpenVPN parent server not found');
			}

			const secret = speakeasy.generateSecret({
				name: `FWCloud OpenVPN (${serverCN}/${crt.cn})`,
				length: 32
			});
			const secretFileContent = buildClient2FASecretFile(secret);
			const qrCode = await QRCode.toDataURL(secret.otpauth_url);
			const usersListContent = await getOpenVPN2FAUsersListContent(req.openvpn.openvpn, null, crt.cn);

			const channel = await Channel.fromRequest(req);
			const preparedTargets = await prepareOpenVPN2FATargets(req, targetFirewalls, channel, clusterName);
			for (const { firewall: targetFirewall, communication } of preparedTargets) {
				emitOpenVPN2FANodeStart(channel, targetFirewall, enabled, clusterName);
				emitOpenVPN2FANodeNotice(channel, `Installing OpenVPN 2FA secret for client '${crt.cn}' on '${targetFirewall.name}'`);
				await communication.installOpenVPNServerConfigs(getOpenVPN2FASecretDir(serverCN), [{
					name: getOpenVPN2FASecretFilename(serverCN, crt.cn),
					content: secretFileContent
				}], channel);
				emitOpenVPN2FANodeNotice(channel, `Updating OpenVPN 2FA users list '${getOpenVPN2FAServerUsersFilename(serverCN)}' on '${targetFirewall.name}'`);
				await communication.installOpenVPNServerConfigs('/etc/openvpn', [{
					name: getOpenVPN2FAServerUsersFilename(serverCN),
					content: usersListContent
				}], channel);
				emitOpenVPN2FANodeEnd(channel, targetFirewall, enabled);
			}
			await ensureClient2FAOpenVPNOptions(req.dbCon, req.body.openvpn, crt.cn);

			const pgp = new PgpHelper({public: req.session.uiPublicKey, private: ""});
			totpData = {
				secret: await pgp.encrypt(secret.base32),
				otpauth_url: await pgp.encrypt(secret.otpauth_url),
				dataURL: await pgp.encrypt(qrCode)
			};
		} else {
			await disableOpenVPNClient2FA(req, firewall, crt, clusterName);
		}

		if (enabled) {
			await new Promise((resolve, reject) => {
				req.dbCon.query(
					`UPDATE openvpn SET tfa_enabled=${req.dbCon.escape(1)}, installed_at=NOW(), updated_at=NOW() WHERE id=${req.dbCon.escape(req.body.openvpn)}`,
					(error, result) => {
						if (error) return reject(error);
						resolve(result);
					}
				);
			});

			await OpenVPN.updateOpenvpnStatus(req.dbCon, req.body.openvpn, "&~1");
		}

		if (enabled) {
			res.status(200).json(totpData);
		} else {
			res.status(204).end();
		}
	} catch (error) {
		logger().error('Error getting openvpn 2fa client data: ' + Object.prototype.hasOwnProperty(error, "message") ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}
		
		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});

router.put('/2fa/regenerate', async (req, res, next) => {
	try {
		const firewall = await db.getSource().manager.getRepository(Firewall).findOneOrFail({
			where: { id: req.body.firewall }
		});

		const crt = await Crt.getCRTdata(req.dbCon, req.openvpn.crt);
		if (crt.type !== 1)
			throw fwcError.VPN_NOT_CLI;

		const serverRows = await new Promise((resolve, reject) => {
			req.dbCon.query(
				`SELECT crt.cn FROM openvpn
				INNER JOIN crt ON openvpn.crt = crt.id
				WHERE openvpn.id=${req.dbCon.escape(req.openvpn.openvpn)}
				AND openvpn.firewall=${req.dbCon.escape(firewall.id)}
				LIMIT 1`,
				(error, rows) => {
					if (error) return reject(error);
					resolve(rows);
				}
			);
		});

		const serverCN = serverRows?.[0]?.cn;
		if (!serverCN) {
			throw fwcError.other('OpenVPN parent server not found');
		}

		let secret = req.body.secret;
		if (!secret) {
			const communication = await (firewall.install_communication === FirewallInstallCommunication.SSH
				? firewall.getCommunication({
					sshuser: Object.prototype.hasOwnProperty.call(req.body, 'sshuser')
						? await new PgpHelper(req.session.pgp).decrypt(req.body.sshuser)
						: undefined,
					sshpassword: Object.prototype.hasOwnProperty.call(req.body, 'sshpass')
						? await new PgpHelper(req.session.pgp).decrypt(req.body.sshpass)
						: undefined,
				})
				: firewall.getCommunication());

			const fileContent = await communication.readOpenVPNFile(
				getOpenVPN2FASecretDir(serverCN),
				getOpenVPN2FASecretFilename(serverCN, crt.cn)
			);
			const rawLines = fileContent.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
			const secretLine = rawLines.find(line => !line.startsWith('"'));
			secret = secretLine ? secretLine : '';
		}

		if (!secret) {
			throw fwcError.other('TOTP secret not found');
		}

		const otpauth_url = speakeasy.otpauthURL({
				secret,
				label: encodeURIComponent(`FWCloud OpenVPN (${serverCN}/${crt.cn})`),
				encoding: 'base32',
			});

		const dataURL = await QRCode.toDataURL(otpauth_url);

		const pgp = new PgpHelper({public: req.session.uiPublicKey, private: ""});

		let data = {
			secret,
			otpauth_url,
			dataURL,
		};

		data.secret = await pgp.encrypt(data.secret);
		data.otpauth_url = await pgp.encrypt(data.otpauth_url);
		data.dataURL = await pgp.encrypt(data.dataURL);

		res.status(200).json(data);
	} catch (error) {
		logger().error('Error regenerating openvpn 2fa data: ' + Object.prototype.hasOwnProperty(error, 'message') ? error.message : JSON.stringify(error));

		if (error instanceof HttpException) {
			return next(error);
		}

		if (error.message)
			res.status(400).json({ message: error.message });
		else
			res.status(400).json(error);
	}
});

module.exports = router;
