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

var streamModel = require('../../models/stream/stream');

var config = require('../../config/apiconf.json');

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.append = (path) => {
	return new Promise((resolve,reject) => {
		var fs = require('fs');

		try {
			 var data= fs.readFileSync(path, 'utf8');
			 resolve(data);
		} catch(error) {
			reject(error);
		}
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.dump = (accessData,cloud,fw,type) => {
	return new Promise((resolve,reject) => { 
  	Policy_cModel.getPolicy_cs_type(cloud, fw, type, async (error, data) => {
			if (error)
				return reject(error);

			for (var ps="", i=0; i<data.length; i++) {
				streamModel.pushMessageCompile(accessData, "RULE "+data[i].rule_order+" (ID: "+data[i].id+")\n");
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
PolicyScript.upload = (cloud,fw,connSettings) => {
  var Client = require('ssh2').Client;
	var conn = new Client();

	return new Promise((resolve,reject) => { 
		conn.on('ready', () => {
			conn.sftp((err, sftp) => {
				if (err)  return reject(err);

				var fs = require("fs"); // Use node filesystem
        var readStream = fs.createReadStream(config.policy.data_dir+"/"+cloud+"/"+fw+"/"+config.policy.script_name).on('error',error => {conn.end(); reject(error)});
        var writeStream = sftp.createWriteStream(config.policy.script_name).on('error',error => {conn.end(); reject(error)});

				writeStream
					.on('close',() => resolve( "File transferred succesfully"))
					.on('end', () => {conn.close(); reject("sftp connection closed")});

        // initiate transfer of file
				readStream.pipe(writeStream);
			});
		})
		.on('error',error => reject(error))
		.connect(connSettings);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.run_ssh_command = (connSettings,cmd) => {
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
					if (str==="[sudo] password for "+connSettings.username+": ")
						stream.write(connSettings.password+"\n");
					stdout_log += data;
				}).stderr.on('data', data => {
					//console.log('STDERR: ' + data);
					stderr_log += data;
				});
			});
		})
		.on('error', error => reject(error))
		.connect(connSettings);
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/

/*----------------------------------------------------------------------------------------------------------------------*/
PolicyScript.install = (accessData,cloud,fw,sshuser,sshpass) => {
	var connSettings = {
		host: '10.99.5.101',
		port: 22,
		username: sshuser,
		password: sshpass
	}

	return new Promise(async (resolve,reject) => { 
		streamModel.pushMessageCompile(accessData, "Uploading firewall scritp ("+connSettings.host+")\n");
		await PolicyScript.upload(cloud,fw,connSettings)
			.then(() => {
				streamModel.pushMessageCompile(accessData, "Installing firewall script.\n");
				return PolicyScript.run_ssh_command(connSettings,"sudo mkdir -m 700 -p "+config.policy.script_dir)
			})
			.then(() => {return PolicyScript.run_ssh_command(connSettings,"sudo chown root:root "+config.policy.script_dir)})
			.then(() => {return PolicyScript.run_ssh_command(connSettings,"sudo chmod 700 "+config.policy.script_name)})
			.then(() => {return PolicyScript.run_ssh_command(connSettings,"sudo chown root:root "+config.policy.script_name)})
			.then(() => {return PolicyScript.run_ssh_command(connSettings,"sudo mv "+config.policy.script_name+" "+config.policy.script_dir)})
			.then(() => {
				streamModel.pushMessageCompile(accessData, "Loading firewall policy.\n");
				return PolicyScript.run_ssh_command(connSettings,"sudo "+config.policy.script_dir+"/"+config.policy.script_name+" start")
			})
			.then(data => {
				streamModel.pushMessageCompile(accessData, data+"\n");
				resolve("DONE")
			})
			.catch(error => {
				streamModel.pushMessageCompile(accessData, "ERROR: "+error+"\n");
				reject(error)
			});
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/