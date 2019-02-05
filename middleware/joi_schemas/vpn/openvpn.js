var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');

schema.validate = req => {
	return new Promise(async(resolve, reject) => {
		var schema = Joi.object().keys({ fwcloud: sharedSch.id });

		var schemaPar = Joi.object().keys({
			name: Joi.alternatives().when('scope', {
				is: 1,
				then: Joi.string().valid(['askpass', 'auth-nocache', 'auth-retry', 'auth-user-pass-verify', 'auth-user-pass',
					'auth', 'bcast-buffers', 'ca', 'ccd-exclusive', 'cd', 'cert', 'chroot', 'cipher', 'client-cert-not-required', 'client-config-dir',
					'client-connect', 'client-disconnect', 'client-to-client', 'client', 'comp-lzo', 'comp-noadapt', 'config', 'connect-freq',
					'connect-retry', 'crl-verify', 'cryptoapicert', 'daemon', 'dev-node', 'dev-type', 'dev', 'dh', 'dhcp-option', 'dhcp-release',
					'dhcp-renew', 'disable-occ', 'disable', 'down-pre', 'down', 'duplicate-cn', 'echo', 'engine', 'explicit-exit-notify', 'fast-io',
					'float', 'fragment', 'group', 'hand-window', 'hash-size', 'http-proxy-option', 'http-proxy-retry', 'http-proxy-timeout',
					'http-proxy server', 'ifconfig-noexec', 'ifconfig-nowarn', 'ifconfig-pool-linear', 'ifconfig-pool-persist', 'ifconfig-pool',
					'ifconfig-push', 'ifconfig', 'inactive', 'inetd', 'ip-win32 method', 'ipchange', 'iroute', 'keepalive', 'key-method', 'key', 'keysizen',
					'learn-address', 'link-mtu', 'local', 'log-append', 'log', 'suppress-timestamps', 'lport', 'management-hold', 'management-log-cache',
					'management-query-passwords', 'management', 'max-clients', 'max-routes-per-client', 'mktun', 'mlock', 'mode', 'mssfix', 'mtu-disc',
					'mtu-test', 'multihome', 'mute-replay-warnings', 'mute', 'nice', 'no-iv', 'no-replay', 'nobind', 'ns-cert-type', 'passtos', 'pause-exit', 'persist-key',
					'persist-local-ip', 'persist-remote-ip', 'persist-tun', 'ping-exit', 'ping-restart', 'ping-timer-rem', 'ping', 'pkcs12', 'plugin', 'port',
					'proto', 'pull', 'push-reset', 'push', 'rcvbuf size', 'redirect-gateway', 'remap-usr1', 'remote-cert-tls', 'remote-random', 'remote', 'reneg-bytes',
					'reneg-pkts', 'reneg-sec', 'replay-persist', 'replay-window', 'resolv-retry', 'rmtun', 'route-delay', 'route-gateway', 'route-method',
					'route-noexec', 'route-up', 'route', 'rport', 'secret', 'server-bridge', 'server', 'service', 'setenv', 'shaper', 'show-adapters',
					'show-ciphers', 'show-digests', 'show-engines', 'show-net-up', 'show-net', 'show-tls', 'show-valid-subnets', 'single-session', 'sndbuf',
					'socks-proxy-retry', 'socks-proxy', 'status', 'status-version', 'syslog', 'tap-sleep', 'tcp-queue-limit', 'test-crypto', 'tls-auth',
					'tls-cipher', 'tls-client', 'tls-exit', 'tls-remote', 'tls-server', 'tls-timeout', 'tls-verify', 'topology', 'tmp-dir', 'tran-window ', 'tun-ipv6',
					'tun-mtu-extra', 'tun-mtu', 'txqueuelen', 'up-delay', 'up-restart', 'up cmd', 'user', 'username-as-common-name ', 'verb', 'writepid'
				]),
				otherwise: Joi.string().valid(['push', 'push-reset', 'iroute', 'iroute-ipv6', 'ifconfig-push',
					'ifconfig-ipv6-push', 'disable', 'config'
				])
			}),
			//arg: Joi.string().regex(/^[ -~\x80-\xFE]{1,128}$/).allow(null).allow('').optional(),
			arg: Joi.alternatives()
				.when('name', { is: 'port', then: Joi.string().regex(/^[0-9]{1,6}$/) })
				.when('name', { is: 'lport', then: Joi.string().regex(/^[0-9]{1,6}$/) })
				.when('name', { is: 'rport', then: Joi.string().regex(/^[0-9]{1,6}$/) })
				.when('name', { is: 'topology', then: Joi.valid(['net30','p2p','subnet']) })
				.when('name', { is: 'proto', then: Joi.valid(['udp','tcp-client','tcp-server']) })
				.when('name', { is: 'proto-force', then: Joi.valid(['udp','tcp-client','tcp-server']) })
				.when('name', { is: 'verb', then: Joi.valid(['0','1','2','3','4','5','6','7','8','9','10','11']) })
				.when('name', { is: 'script-security', then: Joi.valid(['0','1','2','3']) })
				.when('name', { is: 'comp-lzo', then: Joi.string().valid(['yes','no','adaptive']) })
				.when('name', { is: 'route-gateway', then: Joi.string().valid(['gw','dhcp']) })
				.when('name', { is: 'redirect-gateway', then: Joi.string().valid(['local','autolocal','def1','bypass-dhcp','bypass-dns','block-local']) })
				.when('name', { is: 'redirect-private', then: Joi.string().valid(['local','autolocal','def1','bypass-dhcp','bypass-dns','block-local']) })
				.when('name', { is: 'mtu-disc', then: Joi.string().valid(['no','maybe','yes']) })
				.when('name', { is: 'socket-flags', then: Joi.string().valid(['TCP_NODELAY']) })
				.when('name', { is: 'remote-cert-tls', then: Joi.string().valid(['server','client']) })
				.when('name', { is: 'ns-cert-type', then: Joi.string().valid(['server','client']) })
				.when('name', { is: 'resolv-retry', then: Joi.string().regex(/^infinite|[0-9]{1,10}$/) })
				.when('name', { is: 'dev', then: Joi.string().regex(/^tun|tap[0-9]{1,6}$/).allow('') })
				.when('name', { is: 'dev-type', then: Joi.string().valid(['tun','tap']) })
				.when('name', { is: 'cipher', then: Joi.string().regex(/^[a-zA-Z0-9\-]{2,64}$/) })
				.when('name', { is: 'config', then: sharedSch.linux_path })
				.when('name', { is: 'ifconfig-pool-persist', then: sharedSch.linux_path })
				.when('name', { is: 'client-config-dir', then: sharedSch.linux_path })
				.when('name', { is: 'ipchange', then: sharedSch.linux_path })
				.when('name', { is: 'iproute', then: sharedSch.linux_path })
				.when('name', { is: 'cd', then: sharedSch.linux_path })
				.when('name', { is: 'chroot', then: sharedSch.linux_path })
				.when('name', { is: 'log', then: sharedSch.linux_path })
				.when('name', { is: 'log-append', then: sharedSch.linux_path })
				.when('name', { is: 'writepid', then: sharedSch.linux_path })
				.when('name', { is: 'tmp-dir', then: sharedSch.linux_path })
				.when('name', { is: 'user', then: sharedSch.linux_user })
				.when('name', { is: 'group', then: sharedSch.linux_user })
				.when('name', { is: 'management-client-user', then: sharedSch.linux_user })
				.when('name', { is: 'management-client-group', then: sharedSch.linux_user })
				.when('name', { is: 'connect-retry', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'connect-timeout', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'connect-retry-max', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'http-proxy-timeout', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'max-routes', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'route-metric', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'link-mtu', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'tun-mtu', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'tun-mtu-extra', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'fragment', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'mssfix', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'sndbuf', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'rcvbuf', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'mark', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'txqueuelen', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'shaper', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'ping', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'ping-exit', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'ping-restart', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'nice', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'mute', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'management-log-cache', then: Joi.string().regex(/^[0-9]{1,10}$/) })
				.when('name', { is: 'client', then: Joi.valid('') })
				.when('name', { is: 'persist-key', then: Joi.valid('') })
				.when('name', { is: 'persist-tun', then: Joi.valid('') })
				.when('name', { is: 'nobind', then: Joi.valid('') })
				.when('name', { is: 'tls-client', then: Joi.valid('') })
				.when('name', { is: 'float', then: Joi.valid('') })
				.when('name', { is: 'multihome', then: Joi.valid('') })
				.when('name', { is: 'ccd-exclusive', then: Joi.valid('') })
				.when('name', { is: 'keepalive', then: Joi.string().regex(/^[0-9]{1,10} [0-9]{1,10}$/), otherwise: Joi.string().regex(/^[ -~\x80-\xFE]{1,128}$/).allow(null).allow('').optional() }),
			ipobj: Joi.alternatives()
				.when('name', { is: 'server', then: sharedSch.id })
				.when('name', { is: 'remote', then: sharedSch.id })
				.when('name', { is: 'ifconfig-push', then: sharedSch.id, otherwise: Joi.valid(null) }),
			scope: sharedSch._0_1, // 0=ccd, 1=config file
			comment: sharedSch.comment
		});

		if (req.method==="POST" && req.url==='/vpn/openvpn') {
			schema = schema.append({
				openvpn: sharedSch.id.optional(), // Necessary when creating a new OpenVPN client configuration.
				firewall: sharedSch.id,
				crt: sharedSch.id,
				install_dir: sharedSch.linux_path.optional(),
				install_name: Joi.string().regex(/^[a-zA-Z0-9\-_\.]{2,64}$/).optional(),
				options: Joi.array().items(schemaPar),
				node_id: sharedSch.id
			});
		} else if (req.method==="PUT") {
			if (req.url==='/vpn/openvpn') {
				schema = schema.append({
					openvpn: sharedSch.id,
					install_dir: sharedSch.linux_path.optional(),
					install_name: Joi.string().regex(/^[a-zA-Z0-9\-_\.]{2,64}$/).optional(),
					options: Joi.array().items(schemaPar)
				});
			}
			else if (req.url==='/vpn/openvpn/install') {
				schema = schema.append({
					firewall: sharedSch.id,
					openvpn: sharedSch.id,
					sshuser: sharedSch.linux_user,
					sshpass: sharedSch.linux_pass,
					socketid: sharedSch.socketio_id.optional()
				});
			}
			else if (req.url==='/vpn/openvpn/get' || req.url==='/vpn/openvpn/del' 
					|| req.url==='/vpn/openvpn/ip/get' || req.url==='/vpn/openvpn/ipobj/get'
					|| req.url==='/vpn/openvpn/restricted' || req.url==='/vpn/openvpn/file/get') {
				schema = schema.append({ openvpn: sharedSch.id });
			}
		} else return reject(new Error('Request method not accepted'));

		try {
			await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
			resolve();
		} catch (error) { return reject(error) }
	});
};