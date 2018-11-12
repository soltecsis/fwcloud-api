var schema = {};
module.exports = schema;

const Joi = require('joi');
const sharedSch = require('../shared');
 
schema.validate = req => {
  return new Promise(async (resolve, reject) => {
    var schemaPar = Joi.object().keys({
      name: Joi.string().valid(['askpass','auth-nocache','auth-retry','auth-user-pass-verify','auth-user-pass',
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
        'tun-mtu-extra','tun-mtu','txqueuelen','up-delay','up-restart','up cmd','user','username-as-common-name ','verb','writepid']),
      arg: Joi.string().regex(/^[a-zA-Z0-9\-_ ]{2,128}$/),
      ipobj: sharedSch.id.allow(null),
      scope: sharedSchema._0_1
    });

    var schema = Joi.object().keys({
      firewall: sharedSch.id,
      crt: sharedSch.id,
      options: Joi.array().items(schemaPar)
    });

    if (req.method==="POST" && req.url==='/vpn/openvpn/cfg') {
    } else return reject(new Error('Request method not accepted'));

    try {
      await Joi.validate(req.body, schema, sharedSch.joiValidationOptions);
      resolve();
    } catch(error) { return reject(error) } 
  });
};
