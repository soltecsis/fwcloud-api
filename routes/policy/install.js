/**
 * Module to routing INSTALL requests
 * <br>BASE ROUTE CALL: <b>/policy/install</b>
 *
 * @module Install
 * 
 * @requires express
 * @requires Policy_rModel
 * 
 */


/**
 * Clase to manage Install Policy
 *
 * @class InstallRouter
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
 * Property Model to manage Policy Data
 *
 * @property PolicyModel
 * @type /models/policy_r
 */
var Policy_rModel = require('../../models/policy_r');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 *
 */
var logger = require('log4js').getLogger("compiler");

/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type /models/api_response
 * 
 */
var api_resp = require('../../utils/api_response');

/*----------------------------------------------------------------------------------------------------------------------*/
function dump_policy_script() {
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
router.get('/:user/:cloud/:fw', (req, res) => {
  var user = req.params.user;
  var cloud = req.params.cloud;
  var fw = req.params.fw;

  /* Generate the policy script. */
  dump_policy_script();

  var Client = require('ssh2').Client;
  var conn = new Client();

  conn.on(
    'connect',
    function () {
        console.log( "- connected" );
    }
);
 
conn.on(
    'ready',
    function () {
        console.log( "- ready" );
 
        conn.sftp(
            function (err, sftp) {
                if ( err ) {
                    console.log( "Error, problem starting SFTP: %s", err );
                    process.exit( 2 );
                }
 
                console.log( "- SFTP started" );
 
                // upload file
                var readStream = fs.createReadStream( "/proc/meminfo" );
                var writeStream = sftp.createWriteStream( "/tmp/meminfo.txt" );
 
                // what to do when transfer finishes
                writeStream.on(
                    'close',
                    function () {
                        console.log( "- file transferred" );
                        sftp.end();
                        process.exit( 0 );
                    }
                );
 
                // initiate transfer of file
                readStream.pipe( writeStream );
            }
        );
    }
);
 
conn.on(
    'error',
    function (err) {
        console.log( "- connection error: %s", err );
        process.exit( 1 );
    }
);
 
conn.on(
    'end',
    function () {
        process.exit( 0 );
    }
);
 
conn.connect(
    {
        "host": "10.0.0.1",
        "port": 22,
        "username": "root",
        "privateKey": "/home/root/.ssh/id_root"
    }
);


  conn.on('ready', function() {
    console.log('Client :: ready');
  conn.exec('uptime', function(err, stream) {
    if (err) throw err;
    stream.on('close', function(code, signal) {
      console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
      conn.end();
    }).on('data', function(data) {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', function(data) {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '192.168.100.100',
  port: 22,
  username: 'frylock',
  password: 'nodejsrules'
});
});
/*----------------------------------------------------------------------------------------------------------------------*/

module.exports = router;