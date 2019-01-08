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

const sshTools = require('../../utils/ssh');

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
			data.cs += "options_load() {\n"+
				"echo\n"+
				"echo \"OPTIONS\"\n"+
				"echo \"-------\"\n";
			
			// IPv4 packet forwarding
			action = (options & 0x0002) ? '1' : '0';
			data.cs += 'if [ -z "$SYSCTL" ]; then\n' +
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
PolicyScript.dump = (accessData,fwcloud,fw,type) => {
	return new Promise((resolve,reject) => { 
  	Policy_cModel.getPolicy_cs_type(fwcloud, fw, type, async (error, data) => {
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
					await RuleCompile.get(fwcloud,fw,type,data[i].id)
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
PolicyScript.install = (req, SSHconn, firewall) => {
	return new Promise(async (resolve,reject) => {
		const accessData = {sessionID: req.sessionID, iduser: req.session.user_id};

		try {
			streamModel.pushMessageCompile(accessData, "Uploading firewall script ("+SSHconn.host+")\n");
			await sshTools.uploadFile(SSHconn,config.get('policy').data_dir+"/"+req.body.fwcloud+"/"+firewall+"/"+config.get('policy').script_name,config.get('policy').script_name);
		
			// Enable bash depuration if it is selected in firewalls/cluster options.
			const options = await firewallModel.getFirewallOptions(req.body.fwcloud,firewall);
			const bash_debug = (options & 0x0008) ? ' -x' : '';
	
			streamModel.pushMessageCompile(accessData, "Installing firewall script.\n");
			await sshTools.runCommand(SSHconn,"sudo bash"+bash_debug+" ./"+config.get('policy').script_name+" install");

			streamModel.pushMessageCompile(accessData, "Loading firewall policy.\n");
			const data = await sshTools.runCommand(SSHconn,"sudo bash"+bash_debug+" -c 'if [ -d /etc/fwcloud ]; then "+
				"bash"+bash_debug+" /etc/fwcloud/"+config.get('policy').script_name+" start; "+
				"else bash"+bash_debug+" /config/scripts/post-config.d/"+config.get('policy').script_name+" start; fi'")

			streamModel.pushMessageCompile(accessData, data+"\nEND\n");
			resolve("DONE");
		} catch(error) { 
			streamModel.pushMessageCompile(accessData, "ERROR: "+error+"\n");
			reject(error);
		}
	});
}
/*----------------------------------------------------------------------------------------------------------------------*/