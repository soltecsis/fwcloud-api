var db = require('../../db.js');
const fwcError = require('../../utils/error_table');

var firewallExport = {};
//Export the object
module.exports = firewallExport;

function exportAddrs(row) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql = 'select * from ipobj where interface=' + connection.escape(row.id);
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				resolve(rows);
			});
		});
	});
};

function exportInterfaces(connection, id) {
	return new Promise((resolve, reject) => {
		let sql = 'select * from interface where firewall=' + connection.escape(id);
		connection.query(sql, (error, interfaces) => {
			if (error) return reject(error);

			// The order is preserved regardless of what resolved first	
			Promise.all(interfaces.map(exportAddrs))
			.then(addrs => {
				for(let i=0; i<interfaces.length; i++)
					interfaces[i].addresses = addrs[i];
				resolve(interfaces);
			})
			.catch(error => reject(error));
		});
	});
}


function exportRuleInterfaces(row) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			var sql = 'select * from policy_r__interface where rule=' + connection.escape(row.id);
			connection.query(sql, (error, rows) => {
				if (error) return reject(error);
				resolve(rows);
			});
		});
	});
};

function exportPolicyInterfaces(rules) {
	return new Promise((resolve, reject) => {
		// The order is preserved regardless of what resolved first	
		Promise.all(rules.map(exportRuleInterfaces))
		.then(ruleInterfaces => {
			for(let i=0; i<ruleInterfaces.length; i++)
				rules[i].interfaces = ruleInterfaces[i];
			resolve(rules);
		})
		.catch(error => reject(error));
	});
}


function exportRuleIpobjData(ruleIpobj) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
      let sql ='';
      if (ruleIpobj.ipobj!==-1)
        sql = 'select * from ipobj where id=' + connection.escape(ruleIpobj.ipobj);
      else if (ruleIpobj.ipobj_g!==-1)
        sql = 'select * from ipobj_g where id=' + connection.escape(ruleIpobj.ipobj_g);
      else if (ruleIpobj.interface!==-1)
        sql = 'select * from interface where id=' + connection.escape(ruleIpobj.interface);
			connection.query(sql, (error, ipobjDetail) => {
				if (error) return reject(error);
				resolve(ipobjDetail);
			});
		});
	});
};

function exportRuleIpobjs(row) {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);
			let sql = 'select * from policy_r__ipobj where rule=' + connection.escape(row.id);
			connection.query(sql, (error, ipobjs) => {
				if (error) return reject(error);

				Promise.all(ipobjs.map(exportRuleIpobjData))
				.then(ipobjsDetailed => {
					for(let i=0; i<ipobjs.length; i++)
						ipobjs[i].data = ipobjsDetailed[i];
					resolve(ipobjs);
				})
				.catch(error => reject(error));
			});
		});
	});
};

function exportPolicyIpobjs(rules) {
	return new Promise((resolve, reject) => {
		// The order is preserved regardless of what resolved first	
		Promise.all(rules.map(exportRuleIpobjs))
		.then(ruleIpobjs => {
			for(let i=0; i<ruleIpobjs.length; i++)
				rules[i].ipobjs = ruleIpobjs[i];
			resolve(rules);
		})
		.catch(error => reject(error));
	});
}

function exportPolicy(connection, id) {
	return new Promise((resolve, reject) => {
		let sql = 'select * from policy_r where firewall=' + connection.escape(id);
		connection.query(sql, async (error, rules) => {
			if (error) return reject(error);

			try {
				await exportPolicyInterfaces(rules);
				await exportPolicyIpobjs(rules);
				resolve(rules);
			}	catch(error) { reject(error); } 
		});
	});
}

/**
 * Export firewall data
 *  
 */
firewallExport.exportFirewall = id => {
	return new Promise((resolve, reject) => {
		db.get((error, connection) => {
			if (error) return reject(error);

			let sql = 'select * from firewall where id=' + connection.escape(id);
			connection.query(sql, async (error, firewallData) => {
				if (error) return reject(error);
				if (firewallData.length!==1) return reject(fwcError.NOT_FOUND);

				try {
					firewallData[0].interfaces = await exportInterfaces(connection,id);
					firewallData[0].policy = await exportPolicy(connection,id);
				} catch (error) {
					reject(error);
				}

				resolve(firewallData[0]);
			});
		});
	});
};

