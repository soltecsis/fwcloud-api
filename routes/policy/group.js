var express = require('express');
var router = express.Router();
var Policy_gModel = require('../../models/policy/policy_g');
var Policy_rModel = require('../../models/policy/policy_r');
var api_resp = require('../../utils/api_response');
var objModel = 'POLICY GROUP';
var db = require('../../db.js');


var logger = require('log4js').getLogger("app");
var utilsModel = require("../../utils/utils.js");

/* Create New policy_g */
router.post('/', (req, res) => {
	var JsonCopyData = req.body;
	var policy_gData = JsonCopyData.groupData;

	Policy_gModel.insertPolicy_g(policy_gData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_g Get data
			if (data && data.insertId)
			{
				if (policy_gData.rulesIds.length > 0) {
					var idGroup = data.insertId;
					//Add rules to group
					for (var rule of policy_gData.rulesIds) {
						Policy_rModel.updatePolicy_r_Group(policy_gData.firewall,null, idGroup, rule, function (error, data) {
							logger.debug("ADDED to Group " + idGroup + " POLICY: " + rule);
						});
					}
				}
				var dataresp = {"insertId": data.insertId};
				api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});


/* Update policy_g that exist */
router.put('/', (req, res) => {
	//Save data into object
	var policy_gData = {
		id: req.body.id, 
		name: req.body.name, 
		firewall: req.body.firewall, 
		comment: req.body.comment, 
		groupStyle: req.body.style
	};

	Policy_gModel.updatePolicy_g(policy_gData, (error, data) => {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
		else {
			//If saved policy_g saved ok, get data
			if (data && data.result)
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
		}
	});
});

/* Update Style policy_g  */
router.put('/style', (req, res) => {    
	var accessData = { iduser: req.session.user_id, fwcloud: req.body.fwcloud, idfirewall: req.body.firewall };
	 
	var style = req.body.groupStyle;
	var groupIds = req.body.groupIds;

	db.lockTableCon("policy_g", " WHERE firewall=" + accessData.idfirewall , function () {
		db.startTXcon(function () {
			for (var group of groupIds) {
				Policy_gModel.updatePolicy_g_Style(accessData.idfirewall, group,  style, function (error, data) {
					if (error)
						logger.debug("ERROR UPDATING STYLE for GROUP: " + group + "  STYLE: " + style);                                
					if (data && data.result) {
						logger.debug("UPDATED STYLE for GROUP: " + group + "  STYLE: " + style);
					} else
						logger.debug("NOT UPDATED STYLE for GROUP: " + group + "  STYLE: " + style);
				});
			}
			db.endTXcon(function () {});
		});
	});
	api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'STYLE GROUP UPDATED OK', 'POLICY', null, function (jsonResp) {
		res.status(200).json(jsonResp);
	});
});


/* Update policy_g NAMe  */
router.put('/name', (req, res) => {
	//Save data into object
	var policy_gData = { id: req.body.id, name: req.body.name };
	Policy_gModel.updatePolicy_g_name(policy_gData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved policy_g saved ok, get data
			if (data && data.result)
			{
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'GROUP NAME UPDATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});


/* Remove policy_g */
router.put("/del", (req, res) => {
	//Id from policy_g to remove
	var idfirewall = req.body.firewall;
	var id = req.body.id;

	//Remove group from Rules
	Policy_rModel.updatePolicy_r_GroupAll(idfirewall, id, function (error, data) {
		logger.debug("Removed all Policy from Group " + id);
		Policy_gModel.deletePolicy_g(idfirewall, id, function (error, data)
		{
			if (error)
				api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			else {
				if (data && data.result)
				{
					api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				} else
				{
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
						res.status(200).json(jsonResp);
					});
				}
			}
		});
	});
});

/* Remove rules from Group */
router.put("/rulesdel", async (req, res) => {
	try {
		await removeRules(req.body.firewall, req.body.id, req.body.rulesIds);
		// If after removing the rules the group is empty, remove the rules group from the data base.
		await Policy_gModel.deleteIfEmptyPolicy_g(req.dbCon, req.body.firewall, req.body.id);
		api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', 'POLICY GROUP', null, jsonResp => res.status(200).json(jsonResp))
	} catch(error) { api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'not found', 'POLICY GROUP', error, jsonResp => res.status(200).json(jsonResp)) }
});

async function removeRules(idfirewall, idgroup, rulesIds)
{
	return new Promise(async (resolve, reject) => {
		for (let rule of rulesIds) {
			await ruleRemove(idfirewall, idgroup, rule)
			.then(() => resolve())
			.catch(error => reject(error));
		}
	});
}

function ruleRemove(idfirewall, idgroup, rule) {
	return new Promise((resolve, reject) => {
		Policy_rModel.updatePolicy_r_Group(idfirewall, idgroup, null, rule, (error, data) => {
			if (error) return	reject(error);
			if (data && data.result)
				resolve(api_resp.ACR_DELETED_OK);
			else
				resolve(api_resp.ACR_NOTEXIST);
		});
	});
}







/* Get all policy_gs by firewall*/
/* router.get('/:idfirewall', (req, res) => {
	var idfirewall = req.params.idfirewall;
	Policy_gModel.getPolicy_gs(idfirewall, function (error, data)
	{
		//If exists policy_g get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
}); */

/* Get all policy_gs by firewall and group father*/
/* router.get('/:idfirewall/group/:idgroup', (req, res) => {
	var idfirewall = req.params.idfirewall;
	var idgroup = req.params.idgroup;
	Policy_gModel.getPolicy_gs_group(idfirewall, idgroup, function (error, data)
	{
		//If exists policy_g get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
}); */

/* Get  policy_g by id and  by firewall*/
/* router.get('/:idfirewall/:id', (req, res) => {
	var idfirewall = req.params.idfirewall;
	var id = req.params.id;
	Policy_gModel.getPolicy_g(idfirewall, id, function (error, data)
	{
		//If exists policy_g get data
		if (data && data.length > 0)
		{
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
		//Get Error
		else
		{
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'not found', objModel, null, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		}
	});
}); */

module.exports = router;