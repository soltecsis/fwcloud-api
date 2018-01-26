//create object
var PolicyScript = {};

module.exports = PolicyScript;

/**
* Property Model to manage Policy Compiled Data
*
* @property Policy_cModel
* @type ../../models/policy_c
*/
var Policy_cModel = require('../../models/policy/policy_c');

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type ../../models/compile/
 */
var RuleCompile = require('../../models/policy/rule_compile');

const POLICY_TYPE_INPUT = 1;
const POLICY_TYPE_OUTPUT = 2;
const POLICY_TYPE_FORWARD = 3;

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.generate = (cloud,fw,callback) => {
	var ps = "";
	var policy_type = POLICY_TYPE_INPUT;

  Policy_cModel.getPolicy_cs_type(cloud, fw, policy_type, (error, data) => { 
		for (var i=0; i<data.length; i++) {
			ps += "\r\necho \"RULE "+data[i].rule_order+" (ID: "+data[i].id+"\")\r\n#"+data[i].comment+"\r\n";
			if (!(data[i].c_status_recompile))
				ps += data[i].c_compiled;
			else {	
				// ERROR: This is not correct, I must wait until we have the compilation string.			
				RuleCompile.get(cloud, fw, policy_type, data[i].id, (error,data) => {
					if (error)
						api_resp.getJson(data, api_resp.ACR_ERROR, '', 'COMPILE', null, (jsonResp) => { res.status(200).json(jsonResp); });
					else
						ps += data.cs;
				});							
			}
		}

    callback(error,ps);
  });
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.install = () => {
  
  
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
}
/*----------------------------------------------------------------------------------------------------------------------*/
