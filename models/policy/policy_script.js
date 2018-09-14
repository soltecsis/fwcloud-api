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

var streamModel = require('../../models/stream/stream');

var firewallModel = require('../../models/firewall/firewall');

var config = require('../../config/config');

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.append = path => {
	return new Promise((resolve,reject) => {
		var fs = require('fs');

		try {
			var data = {};
			data.cs = fs.readFileSync(path, 'utf8');
			resolve(data);
		} catch(error) { reject(error); }
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.dumpFirewallOptions = (fwcloud,fw,data) => {
	return new Promise((resolve,reject) => { 
		firewallModel.getFirewallOptions(fwcloud,fw)
		.then(options => {
			var action = '';
			data.options = options;
			data.cs += "options_load {\n";
			
			// IPv4 packet forwarding
			action = (options & 0x0002) ? '1' : '0';
			data.cs += 'if [ -z "$SYSCTL" ]; then\n' +
				'  echo '+action+' > /proc/sys/net/ipv4/ip_forward\n' +
				'else\n' +
				'  $SYSCTL -w net.ipv4.conf.all.forwarding='+action+'\n' +
				'fi\n\n';

			// IPv6 packet forwarding
			action = (options & 0x0004) ? '1' : '0';
			data.cs += '$SYSCTL -w net.ipv6.conf.all.forwarding='+action+'\n';
			
			data.cs += "}\n\n";

			resolve(data);
		})
		.catch(error => reject(error));
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.dump = (accessData,fw,type) => {
	return new Promise((resolve,reject) => { 
  	Policy_cModel.getPolicy_cs_type(accessData.fwcloud, fw, type, async (error, data) => {
			if (error) return reject(error);

			for (var ps="", i=0; i<data.length; i++) {
				streamModel.pushMessageCompile(accessData, "Rule "+(i+1)+" (ID: "+data[i].id+")\n");
				ps += "\necho \"RULE "+(i+1)+" (ID: "+data[i].id+")\"\n";
				if (data[i].comment)
					ps += "# "+data[i].comment.replace(/\n/g,"\n# ")+"\n";
				if (!(data[i].c_status_recompile)) // The compiled string in the database is ok.
					ps += data[i].c_compiled;
				else { // We must compile the rule.
					// The rule compilation order is important, then we must wait until we have the promise fulfilled.
					// For this reason we use await and async for the callback function of Policy_cModel.getPolicy_cs_type
					await RuleCompile.get(accessData.fwcloud,fw,type,data[i].id)
						.then(data => ps += data)
						.catch(error => reject(error));			
				}
			}
		
			resolve(ps);
		});
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.upload = (cloud,fw,SSHconn) => {
  var Client = require('ssh2').Client;
	var conn = new Client();

	return new Promise((resolve,reject) => { 
		conn.on('ready', () => {
			conn.sftp((err, sftp) => {
				if (err)  return reject(err);

				var fs = require("fs"); // Use node filesystem
        var readStream = fs.createReadStream(config.get('policy').data_dir+"/"+cloud+"/"+fw+"/"+config.get('policy').script_name).on('error',error => {conn.end(); reject(error)});
        var writeStream = sftp.createWriteStream(config.get('policy').script_name).on('error',error => {conn.end(); reject(error)});

				writeStream
					.on('close',() => resolve( "File transferred succesfully"))
					.on('end', () => {conn.close(); reject("sftp connection closed")});

        // initiate transfer of file
				readStream.pipe(writeStream);
			});
		})
		.on('error',error => reject(error))
		.connect(SSHconn);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.run_ssh_command = (SSHconn,cmd) => {
  var Client = require('ssh2').Client;
	var conn = new Client();
	var stdout_log = "";
	var stderr_log ="";

	return new Promise((resolve,reject) => { 
		conn.on('ready',() => {
			conn.exec(cmd, {pty: true}, (err, stream) => {
				if (err) return reject(err);
				stream.on('close',(code, signal) => {
					//console.log('Stream :: close :: code: ' + code + ', signal: ' + signal);
					conn.end();
					if (code===0)
						resolve(stdout_log)
					else
						reject("STDOUT: \n"+stdout_log+"\n\nSTDERR: \n"+stderr_log);
				}).on('data', data => {
					//console.log('STDOUT: ' + data);
					var str=""+data;
					if (str==="[sudo] password for "+SSHconn.username+": ")
						stream.write(SSHconn.password+"\n");
					stdout_log += data;
				}).stderr.on('data', data => {
					//console.log('STDERR: ' + data);
					stderr_log += data;
				});
			});
		})
		.on('error', error => reject(error))
		.connect(SSHconn);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.install = (accessData,SSHconn,fw) => {
	return new Promise(async (resolve,reject) => { 
		streamModel.pushMessageCompile(accessData, "Uploading firewall script ("+SSHconn.host+")\n");
		await PolicyScript.upload(accessData.fwcloud,fw,SSHconn)
			.then(() => {
				streamModel.pushMessageCompile(accessData, "Installing firewall script.\n");
				return PolicyScript.run_ssh_command(SSHconn,"sudo sh ./"+config.get('policy').script_name+" install")
			})
			.then(() => {
				streamModel.pushMessageCompile(accessData, "Loading firewall policy.\n");
				//return PolicyScript.run_ssh_command(SSHconn,"sudo "+config.get('policy').script_dir+"/"+config.get('policy').script_name+" start")
				return PolicyScript.run_ssh_command(SSHconn,"sudo bash -c 'if [ -d /etc/fwcloud ]; then "+
					"/etc/fwcloud/"+config.get('policy').script_name+" start; "+
					"else /config/scripts/post-config.d/"+config.get('policy').script_name+" start; fi'")
			})
			.then(data => {
				streamModel.pushMessageCompile(accessData, data+"\nEND\n");
				resolve("DONE")
			})
			.catch(error => {
				streamModel.pushMessageCompile(accessData, "ERROR: "+error+"\n");
				reject(error)
			});
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/