//create object
var sharedSchema = {};
//Export the object
module.exports = sharedSchema;

const Joi = require('joi');

// Options used for the Joi validation function.
// https://github.com/hapijs/joi/blob/v14.0.0/API.md#validatevalue-schema-options-callback
sharedSchema.joiValidationOptions = {convert: false, presence: 'required'};

sharedSchema.id = Joi.number().integer().min(1);

sharedSchema.username = Joi.string().alphanum().min(3).max(32);
sharedSchema.password = Joi.string().regex(/^[ -~\x80-\xFE]{6,64}$/);

sharedSchema.days = Joi.number().integer().min(1).max(36500);
sharedSchema.cn = Joi.string().regex(/^[a-zA-Z0-9\-_]{4,64}$/);

sharedSchema.name = Joi.string().regex(/^[ -~\x80-\xFE]{1,64}$/);
sharedSchema.comment = Joi.string().allow('').allow(null).regex(/^[ -~\x80-\xFE]{1,254}$/).optional();

sharedSchema.img = Joi.string().allow('').allow(null).dataUri().min(3).max(64);

sharedSchema._0_1 = Joi.number().integer().valid([0,1]);

sharedSchema.linux_user = Joi.string().regex(/^[a-zA-Z_]([a-zA-Z0-9_-]{0,31}|[a-zA-Z0-9_-]{0,30}\$)$/);
sharedSchema.linux_pass = Joi.string().regex(/^[ -~\x80-\xFE]{2,64}$/);

sharedSchema.mac_addr = Joi.string().regex(/^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/);

sharedSchema.interface_type = Joi.number().integer().valid([10,11]);
sharedSchema.group_type = Joi.number().integer().valid([20,21]);
sharedSchema.policy_type = Joi.number().integer().min(1).max(6);

sharedSchema.ipv4 = Joi.string().ip({ version: ['ipv4'], cidr: 'forbidden'});
sharedSchema.ipv6 = Joi.string().ip({ version: ['ipv6'], cidr: 'forbidden'});

sharedSchema.u8bits = Joi.number().integer().min(0).max(255);
sharedSchema.u16bits = Joi.number().integer().min(0).max(65535);

sharedSchema.rule_action = Joi.number().integer().min(1).max(5);
sharedSchema.rule_position = Joi.number().integer().min(1).max(36);

sharedSchema.date = Joi.date().min(1).max(5);

sharedSchema.crt_type = Joi. number().integer().valid([1,2]);

sharedSchema.openvpn_arg = Joi.string().regex(/^[a-zA-Z0-9\-_ ]{2,128}$/);
sharedSchema.openvpn_par = Joi.string().valid['askpass','auth-nocache','auth-retry','auth-user-pass-verify','auth-user-pass',
  'auth','bcast-buffers','ca','ccd-exclusive','cd','cert','chroot','cipher','client-cert-not-required','client-config-dir',
  'client-connect','client-disconnect','client-to-client','client','comp-lzo','comp-noadapt','config file','connect-freq',
  'connect-retry','crl-verify','cryptoapicert','daemon','dev-node','dev-type','dev','dh','dhcp-option','dhcp-release',
  'dhcp-renew','disable-occ','disable','down-pre','down','duplicate-cn','echo','engine','explicit-exit-notify','fast-io',
  'float','fragment','group','hand-window','hash-size','http-proxy-option','http-proxy-retry','http-proxy-timeout',
  'http-proxy server','ifconfig-noexec','ifconfig-nowarn','ifconfig-pool-linear','ifconfig-pool-persist','ifconfig-pool',
  'ifconfig-push','ifconfig','inactive','inetd','ip-win32 method','ipchange','iroute','keepalive','key-method','key','keysizen',
  'learn-address','link-mtu','local','log-append','log','suppress-timestamps','lport','management-hold','management-log-cache',
  'management-query-passwords','management','max-clients','max-routes-per-client','mktun','mlock','mode','mssfix','mtu-disc',
  'mtu-test','mute-replay-warnings','mute','nice','no-iv','no-replay','nobind','ns-cert-type','passtos','pause-exit','persist-key',
  'persist-local-ip','persist-remote-ip','persist-tun','ping-exit','ping-restart','ping-timer-rem','ping','pkcs12','plugin','port',
  'proto','pull','push-reset','push','rcvbuf size','redirect-gateway','remap-usr1','remote-random','remote','reneg-bytes',
  'reneg-pkts','reneg-sec','replay-persist','replay-window','resolv-retry','rmtun','route-delay','route-gateway','route-method',
  'route-noexec','route-up','route','rport','secret','server-bridge','server','service','setenv','shaper','show-adapters',
  'show-ciphers','show-digests','show-engines','show-net-up','show-net','show-tls','show-valid-subnets','single-session','sndbuf',
  'socks-proxy-retry','socks-proxy','status','status-version','syslog','tap-sleep','tcp-queue-limit','test-crypto','tls-auth',
  'tls-cipher','tls-client','tls-exit','tls-remote','tls-server','tls-timeout','tls-verify','tmp-dir','tran-window ','tun-ipv6',
  'tun-mtu-extra','tun-mtu','txqueuelen','up-delay','up-restart','up cmd','user','username-as-common-name ','verb','writepid'];
