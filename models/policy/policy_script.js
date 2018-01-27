//create object
var PolicyScript = {};

module.exports = PolicyScript;

/**
* Property Model to manage Policy Compiled Data
*
* @property Policy_cModel
* @type /models/policy_c
*/
var Policy_cModel = require('../../models/policy/policy_c');

/**
 * Property Model to manage compilation process
 *
 * @property RuleCompileModel
 * @type /models/compile/
 */
var RuleCompile = require('../../models/policy/rule_compile');

/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 *
 */
var api_resp = require('../../utils/api_response');

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.dump = (cloud,fw,type) => {
	return new Promise((resolve,reject) => { 
  	Policy_cModel.getPolicy_cs_type(cloud, fw, type, async (error, data) => {
			if (error)
				return reject(error);

			for (var ps="", i=0; i<data.length; i++) {
				ps += "\necho \"RULE "+data[i].rule_order+" (ID: "+data[i].id+")\"\n";
				if (data[i].comment)
					ps += "# "+data[i].comment.replace(/\n/g,"\n# ")+"\n";
				if (!(data[i].c_status_recompile)) // The compiled string in the database is ok.
					ps += data[i].c_compiled;
				else { // We must compile the rule.
					// The rule compilation order is important, then we must wait until we have the promise fulfilled.
					// For this reason we use await and async for the callbac function of Policy_cModel.getPolicy_cs_type
					await RuleCompile.get(cloud,fw,type,data[i].id)
						.then(data => ps += data)
						.catch (error => api_resp.getJson(null,api_resp.ACR_ERROR,'','COMPILE',error,jsonResp => res.status(200).json(jsonResp)))				
				}
			}
		
			resolve(ps);
		});
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