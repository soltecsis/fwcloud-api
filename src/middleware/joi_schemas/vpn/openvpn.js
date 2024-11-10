/*
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


var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
const fwcError = require('../../../utils/error_table');
import { PgpHelper } from '../../../utils/pgp';

schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    const item = req.path.split('/');
    if (item[3]==='prefix') {
			try {
				return resolve (await require(`./${item[2]}/${item[3]}`).validate(req));
			} catch(error) { return reject(error) }
		}
	
		var schema = Joi.object().keys({ fwcloud: sharedSch.id });
		
		const validCiphers = [
			'AES-128-CBC', 'aes-128-cbc',
			'AES-128-CFB', 'aes-128-cfb',
			'AES-128-CFB1', 'aes-128-cfb1',
			'AES-128-CFB8', 'aes-128-cfb8',
			'AES-128-GCM', 'aes-128-gcm',
			'AES-128-OFB', 'aes-128-ofb',
			'AES-192-CBC', 'aes-192-cbc',
			'AES-192-CFB', 'aes-192-cfb',
			'AES-192-CFB1', 'aes-192-cfb1',
			'AES-192-CFB8', 'aes-192-cfb8',
			'AES-192-GCM', 'aes-192-gcm',
			'AES-192-OFB', 'aes-192-ofb',
			'AES-256-CBC', 'aes-256-cbc',
			'AES-256-CFB', 'aes-256-cfb',
			'AES-256-CFB1', 'aes-256-cfb1',
			'AES-256-CFB8', 'aes-256-cfb8',
			'AES-256-GCM', 'aes-256-gcm',
			'AES-256-OFB', 'aes-256-ofb',
			'ARIA-128-CBC', 'aria-128-cbc',
			'ARIA-128-CFB', 'aria-128-cfb',
			'ARIA-128-CFB1', 'aria-128-cfb1',
			'ARIA-128-CFB8', 'aria-128-cfb8',
			'ARIA-128-GCM', 'aria-128-gcm',
			'ARIA-128-OFB', 'aria-128-ofb',
			'ARIA-192-CBC', 'aria-192-cbc',
			'ARIA-192-CFB', 'aria-192-cfb',
			'ARIA-192-CFB1', 'aria-192-cfb1',
			'ARIA-192-CFB8', 'aria-192-cfb8',
			'ARIA-192-GCM', 'aria-192-gcm',
			'ARIA-192-OFB', 'aria-192-ofb',
			'ARIA-256-CBC', 'aria-256-cbc',
			'ARIA-256-CFB', 'aria-256-cfb',
			'ARIA-256-CFB1', 'aria-256-cfb1',
			'ARIA-256-CFB8', 'aria-256-cfb8',
			'ARIA-256-GCM', 'aria-256-gcm',
			'ARIA-256-OFB', 'aria-256-ofb',
			'CAMELLIA-128-CBC', 'camellia-128-cbc',
			'CAMELLIA-128-CFB', 'camellia-128-cfb',
			'CAMELLIA-128-CFB1', 'camellia-128-cfb1',
			'CAMELLIA-128-CFB8', 'camellia-128-cfb8',
			'CAMELLIA-128-OFB', 'camellia-128-ofb',
			'CAMELLIA-192-CBC', 'camellia-192-cbc',
			'CAMELLIA-192-CFB', 'camellia-192-cfb',
			'CAMELLIA-192-CFB1', 'camellia-192-cfb1',
			'CAMELLIA-192-CFB8', 'camellia-192-cfb8',
			'CAMELLIA-192-OFB', 'camellia-192-ofb',
			'CAMELLIA-256-CBC', 'camellia-256-cbc',
			'CAMELLIA-256-CFB', 'camellia-256-cfb',
			'CAMELLIA-256-CFB1', 'camellia-256-cfb1',
			'CAMELLIA-256-CFB8', 'camellia-256-cfb8',
			'CAMELLIA-256-OFB', 'camellia-256-ofb',
			'CHACHA20-POLY1305', 'chacha20-poly1305',
			'DES-EDE-CBC', 'des-ede-cbc',
			'DES-EDE-CFB', 'des-ede-cfb',
			'DES-EDE-OFB', 'des-ede-ofb',
			'DES-EDE3-CBC', 'des-ede3-cbc',
			'DES-EDE3-CFB', 'des-ede3-cfb',
			'DES-EDE3-CFB1', 'des-ede3-cfb1',
			'DES-EDE3-CFB8', 'des-ede3-cfb8',
			'DES-EDE3-OFB', 'des-ede3-ofb',
			'SM4-CBC', 'sm4-cbc',
			'SM4-CFB', 'sm4-cfb',
			'SM4-OFB', 'sm4-ofb'
		];
		const cipherRegex = new RegExp(`^(${validCiphers.join('|')})(:(${validCiphers.join('|')}))*$`);

		var schemaPar = Joi.object().keys({
			name: Joi.alternatives().conditional('scope', {
				is: 1,
				then: Joi.string().valid('askpass', 'auth-gen-token', 'auth-nocache', 'auth-retry', 'auth-user-pass-verify', 'auth-user-pass',
					'auth', 'bcast-buffers','block-outside-dns', 'ca', 'ccd-exclusive', 'cd', 'cert', 'chroot', 'cipher', 'data-ciphers', 'data-ciphers-fallback', 'client-cert-not-required', 'client-config-dir',
					'client-connect', 'client-disconnect', 'client-to-client', 'client', 'comp-lzo', 'comp-noadapt', 'config', 'connect-freq',
					'connect-retry', 'crl-verify', 'cryptoapicert', 'daemon', 'dev-node', 'dev-type', 'dev', 'dh', 'dhcp-option', 'dhcp-release',
					'dhcp-renew', 'disable-occ', 'disable', 'down-pre', 'down', 'duplicate-cn', 'echo', 'engine', 'explicit-exit-notify', 'fast-io',
					'float', 'fragment', 'group', 'hand-window', 'hash-size', 'http-proxy-option', 'http-proxy-retry', 'http-proxy-timeout',
					'http-proxy server', 'ifconfig-noexec', 'ifconfig-nowarn', 'ifconfig-pool-linear', 'ifconfig-pool-persist', 'ifconfig-pool',
					'ifconfig-push', 'ifconfig', 'inactive', 'inetd', 'ip-win32 method', 'ipchange', 'iroute', 'keepalive', 'key-method', 'key', 'keysizen',
					'learn-address', 'link-mtu', 'local', 'log-append', 'log', 'suppress-timestamps', 'lport', 'management-hold', 'management-log-cache',
					'management-query-passwords', 'management', 'max-clients', 'max-routes-per-client', 'mktun', 'mlock', 'mode', 'mssfix', 'mtu-disc',
					'mtu-test', 'multihome', 'mute-replay-warnings', 'mute', 'nice', 'no-iv', 'no-replay', 'nobind', 'ns-cert-type', 'remote-cert-tls', 'passtos', 'pause-exit', 'persist-key',
					'persist-local-ip', 'persist-remote-ip', 'persist-tun', 'ping-exit', 'ping-restart', 'ping-timer-rem', 'ping', 'pkcs12', 'plugin', 'port',
					'proto', 'pull', 'push-reset', 'push', 'rcvbuf', 'redirect-gateway', 'remap-usr1', 'remote-cert-tls', 'remote-random', 'remote', 'reneg-bytes',
					'reneg-pkts', 'reneg-sec', 'replay-persist', 'replay-window', 'resolv-retry', 'rmtun', 'route-delay', 'route-gateway', 'route-method',
					'route-noexec', 'route-up', 'route', 'rport', 'script-security', 'secret', 'server-bridge', 'server', 'service', 'setenv', 'shaper', 'show-adapters',
					'show-ciphers', 'show-digests', 'show-engines', 'show-net-up', 'show-net', 'show-tls', 'show-valid-subnets', 'single-session', 'sndbuf',
					'socks-proxy-retry', 'socks-proxy', 'status', 'status-version', 'syslog', 'tap-sleep', 'tcp-queue-limit', 'test-crypto', 'tls-auth', 'tls-crypt-v2',
					'tls-cipher', 'tls-ciphersuites', 'tls-client', 'tls-exit', 'tls-remote', 'tls-server', 'tls-timeout', 'tls-verify', 'tls-version-min', 'tls-version-max','topology', 
					'tmp-dir', 'tran-window ', 'tun-ipv6','tun-mtu-extra', 'tun-mtu', 'txqueuelen', 'up-delay', 'up-restart', 'up', 'user', 'username-as-common-name ', 
					'verb', 'writepid', 
				),
				otherwise: Joi.string().valid('push', 'push-reset', 'iroute', 'iroute-ipv6', 'ifconfig-push',
					'ifconfig-ipv6-push', 'disable', 'config', 'comp-lzo', 'max-routes-per-client'
				)
			}),
			//arg: Joi.string().regex(/^[ -~\x80-\xFE]{1,128}$/).allow(null).allow('').optional(),
			arg: Joi.alternatives()
				.conditional('name', { is: 'port', then: Joi.string().regex(/^[0-9]{1,6}$/) })
				.conditional('name', { is: 'lport', then: Joi.string().regex(/^[0-9]{1,6}$/) })
				.conditional('name', { is: 'rport', then: Joi.string().regex(/^[0-9]{1,6}$/) })
				.conditional('name', { is: 'topology', then: Joi.valid('net30','p2p','subnet') })
				.conditional('name', { is: 'proto', then: Joi.valid('udp','tcp-client','tcp-server') })
				.conditional('name', { is: 'proto-force', then: Joi.valid('udp','tcp-client','tcp-server') })
				.conditional('name', { is: 'verb', then: Joi.valid('0','1','2','3','4','5','6','7','8','9','10','11') })
				.conditional('name', { is: 'script-security', then: Joi.valid('0','1','2','3') })
				.conditional('name', { is: 'comp-lzo', then: Joi.string().valid('yes','no','adaptive') })
				.conditional('name', { is: 'compress', then: Joi.string().valid('lzo','lz4', 'lz4-v2', '') })
				.conditional('name', { is: 'route-gateway', then: Joi.string().valid('gw','dhcp') })
				.conditional('name', { is: 'redirect-gateway', then: Joi.string().valid('local','autolocal','def1','bypass-dhcp','bypass-dns','block-local') })
				.conditional('name', { is: 'redirect-private', then: Joi.string().valid('local','autolocal','def1','bypass-dhcp','bypass-dns','block-local') })
				.conditional('name', { is: 'mtu-disc', then: Joi.string().valid('no','maybe','yes') })
				.conditional('name', { is: 'socket-flags', then: Joi.string().valid('TCP_NODELAY') })
				.conditional('name', { is: 'remote-cert-tls', then: Joi.string().valid('server','client') })
				.conditional('name', { is: 'ns-cert-type', then: Joi.string().valid('server','client') })
				.conditional('name', { is: 'resolv-retry', then: Joi.string().regex(/^infinite|[0-9]{1,10}$/) })
				.conditional('name', { is: 'dev', then: Joi.string().regex(/^tun|vtun|tap[0-9]{1,6}$/).allow('') })
				.conditional('name', { is: 'dev-type', then: Joi.string().valid('tun','tap') })
				.conditional('name', { is: 'cipher', then: Joi.string().valid(...validCiphers)})
				.conditional('name', { is: 'data-ciphers', then: Joi.string().regex(cipherRegex)})
				.conditional('name', { is: 'data-ciphers-fallback', then: Joi.string().valid(...validCiphers)})
				.conditional('name', { is: 'config', then: sharedSch.linux_path })
				.conditional('name', { is: 'ifconfig-pool-persist', then: sharedSch.linux_path })
				.conditional('name', { is: 'client-config-dir', then: sharedSch.linux_path })
				.conditional('name', { is: 'ipchange', then: sharedSch.linux_path })
				.conditional('name', { is: 'iproute', then: sharedSch.linux_path })
				.conditional('name', { is: 'cd', then: sharedSch.linux_path })
				.conditional('name', { is: 'chroot', then: sharedSch.linux_path })
				.conditional('name', { is: 'log', then: sharedSch.linux_path })
				.conditional('name', { is: 'log-append', then: sharedSch.linux_path })
				.conditional('name', { is: 'writepid', then: sharedSch.linux_path })
				.conditional('name', { is: 'tmp-dir', then: sharedSch.linux_path })
				.conditional('name', { is: 'user', then: sharedSch.linux_user })
				.conditional('name', { is: 'group', then: sharedSch.linux_user })
				.conditional('name', { is: 'management-client-user', then: sharedSch.linux_user })
				.conditional('name', { is: 'management-client-group', then: sharedSch.linux_user })
				.conditional('name', { is: 'connect-retry', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'connect-timeout', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'connect-retry-max', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'http-proxy-timeout', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'max-routes', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'route-metric', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'link-mtu', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'tun-mtu', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'tun-mtu-extra', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'fragment', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'mssfix', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'sndbuf', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'rcvbuf', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'mark', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'txqueuelen', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'shaper', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'ping', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'ping-exit', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'ping-restart', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'nice', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'mute', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'management-log-cache', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.conditional('name', { is: 'client', then: Joi.valid('') })
				.conditional('name', { is: 'persist-key', then: Joi.valid('') })
				.conditional('name', { is: 'persist-tun', then: Joi.valid('') })
				.conditional('name', { is: 'nobind', then: Joi.valid('') })
				.conditional('name', { is: 'tls-client', then: Joi.valid('') })
				.conditional('name', { is: 'float', then: Joi.valid('') })
				.conditional('name', { is: 'multihome', then: Joi.valid('') })
				.conditional('name', { is: 'ccd-exclusive', then: Joi.valid('') })
				.conditional('name', { is: 'keepalive', then: Joi.string().regex(/^[0-9]{1,10} [0-9]{1,10}$/), otherwise: Joi.string().regex(/^[ -~\x80-\xFE]{1,128}$/).allow(null).allow('').optional() }),
			ipobj: Joi.alternatives()
				.conditional('name', { is: 'server', then: sharedSch.id })
				.conditional('name', { is: 'remote', then: sharedSch.id })
				.conditional('name', { is: 'ifconfig-push', then: sharedSch.id, otherwise: Joi.valid(null) }),
			scope: sharedSch._0_1, // 0=ccd, 1=config file
			comment: sharedSch.comment
		});

		if (req.method==="POST" && req.path==='/vpn/openvpn') {
			schema = schema.append({
				openvpn: sharedSch.id.optional(), // Necessary when creating a new OpenVPN client configuration.
				firewall: sharedSch.id,
				crt: sharedSch.id,
				install_dir: sharedSch.linux_path.optional(),
				install_name: Joi.string().regex(/^[a-zA-Z0-9\-_\.]{2,64}$/).optional(),
				options: Joi.array().items(schemaPar),
				comment: sharedSch.comment,
				node_id: sharedSch.id
			});
		} else if (req.method==="PUT") {
			if (req.path==='/vpn/openvpn') {
				schema = schema.append({
					openvpn: sharedSch.id,
					install_dir: sharedSch.linux_path.optional(),
					install_name: Joi.string().regex(/^[a-zA-Z0-9\-_\.]{2,64}$/).optional(),
					options: Joi.array().items(schemaPar),
					comment: sharedSch.comment
				});
			}
			else if (req.path==='/vpn/openvpn/install' || req.path==='/vpn/openvpn/uninstall'
					|| req.path==='/vpn/openvpn/ccdsync' || req.path==='/vpn/openvpn/status/get') {
				try {
					const pgp = new PgpHelper(req.session.pgp);
			    // SSH user and password are encrypted with the PGP session key.
					if (req.body.sshuser) req.body.sshuser = await pgp.decrypt(req.body.sshuser);
					if (req.body.sshpass) req.body.sshpass = await pgp.decrypt(req.body.sshpass);
				} catch(error) { return reject(fwcError.other(`PGP decrypt: ${error.message}`)) }

				schema = schema.append({
					firewall: sharedSch.id,
					openvpn: sharedSch.id,
					sshuser: sharedSch.linux_user.optional(),
					sshpass: sharedSch.linux_pass.optional(),
					socketid: sharedSch.socketio_id.optional()
				});
			}
			else if (req.path==='/vpn/openvpn/get' || req.path==='/vpn/openvpn/del' 
					|| req.path==='/vpn/openvpn/ip/get' || req.path==='/vpn/openvpn/ipobj/get'
					|| req.path==='/vpn/openvpn/restricted' || req.path==='/vpn/openvpn/file/get'
					|| req.path==='/vpn/openvpn/info/get' || req.path==='/vpn/openvpn/where') {
				schema = schema.append({ openvpn: sharedSch.id });
			}
			else if (req.path==='/vpn/openvpn/firewall/get') 
				schema = schema.append({ firewall: sharedSch.id });
		} else return reject(fwcError.BAD_API_CALL);

		try {
			await schema.validateAsync(req.body, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};
