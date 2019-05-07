var express = require('express');
var router = express.Router();
var Interface__ipobjModel = require('../../models/interface/interface__ipobj');
var objModel = 'INTERFACE_IPOBJ';
const fwcError = require('../../utils/error_table');


/* Get all interface__ipobjs by interface*/
router.get('/interface/:interface', (req, res) => {
	var interface = req.params.interface;
	Interface__ipobjModel.getInterface__ipobjs_interface(interface, function (error, data)
	{
		//If exists interface__ipobj get data
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
});

/* Get all interface__ipobjs by ipobj*/
router.get('/ipobj/:ipobj', (req, res) => {
	var ipobj = req.params.ipobj;
	Interface__ipobjModel.getInterface__ipobjs_ipobj(ipobj, function (error, data)
	{
		//If exists interface__ipobj get data
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
});

/* Get  interface__ipobj by interface and ipobj*/
router.get('/interface__ipobj/:interface/:ipobj', (req, res) => {
	var interface = req.params.interface;
	var ipobj = req.params.ipobj;
	Interface__ipobjModel.getInterface__ipobj(interface, ipobj, function (error, data)
	{
		//If exists interface__ipobj get data
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
});



/* Create New interface__ipobj */
router.post("/interface__ipobj/", async (req, res) => {
	//Create New objet with data interface__ipobj
	var interface__ipobjData = {
		interface: req.body.interface,
		ipobj: req.body.ipobj,
		interface_order: req.body.interface_order
	};

	try {
		await Interface__ipobjModel.UpdateHOST(req.body.interface);
		insertId = await Interface__ipobjModel.insertInterface__ipobj(req.dbCon, interface__ipobjData);
		api_resp.getJson({"insertId": insertId}, api_resp.ACR_INSERTED_OK, 'INSERTED OK', objModel, null, jsonResp =>	res.status(200).json(jsonResp));
	} catch(error) { api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, jsonResp => res.status(200).json(jsonResp)) }
});

/* Update interface__ipobj that exist */
router.put('/interface__ipobj/', (req, res) => {
	//Save data into object
	var interface__ipobjData = {interface: req.param('interface'), ipobj: req.param('ipobj'), interface_order: req.param('interface_order')};
	var get_interface = req.param('get_interface');
	var get_ipobj = req.param('get_ipobj');
	var get_interface_order = req.param('get_interface_order');

	Interface__ipobjModel.UpdateHOST(get_interface)            
			.then(() => {
				Interface__ipobjModel.updateInterface__ipobj(get_interface, get_ipobj, get_interface_order, interface__ipobjData, function (error, data)
				{
					if (error)
						api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating', objModel, error, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					else {
						//If saved interface__ipobj saved ok, get data
						if (data && data.result)
						{
							api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						} else
						{
							api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
								res.status(200).json(jsonResp);
							});
						}
					}
				});
			});
});
/* Update ORDER interface__ipobj that exist */
router.put('/interface__ipobj/order/:new_order', (req, res) => {
	var new_order = req.param('new_order');
	//Save data into object
	var interface__ipobjData = {interface: req.param('interface'), ipobj: req.param('ipobj'), interface_order: req.param('interface_order')};
	Interface__ipobjModel.updateInterface__ipobj_order(new_order, interface__ipobjData, function (error, data)
	{
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating', objModel, error, function (jsonResp) {
				res.status(200).json(jsonResp);
			});
		else {
			//If saved interface__ipobj saved ok, get data
			if (data && data.result)
			{
				api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'UPDATED OK', objModel, null, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			} else
			{
				api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
					res.status(200).json(jsonResp);
				});
			}
		}
	});
});



/* Remove interface__ipobj */
router.put("/del/interface__ipobj/", (req, res) => {
	//Id from interface__ipobj to remove
	var interface = req.param('interface');
	var ipobj = req.param('ipobj');
	Interface__ipobjModel.UpdateHOST(interface)
			.then(() => {
				Interface__ipobjModel.deleteInterface__ipobj(interface, ipobj, function (error, data)
				{
					if (data && data.result)
					{
						//res.redirect("/interface__ipobjs/");
						api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'DELETED OK', objModel, null, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					} else
					{
						api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error', objModel, error, function (jsonResp) {
							res.status(200).json(jsonResp);
						});
					}
				});
			});
});

module.exports = router;