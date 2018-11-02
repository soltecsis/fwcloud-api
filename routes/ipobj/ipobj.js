/**
 * ROUTE Module to routing IPOBJ requests
 * <br>BASE ROUTE CALL: <b>/ipobjs</b>
 *
 * @module Ipobjs
 * 
 * @requires express
 * @requires IpobjModel
 * 
 */

/**
 * Class to manage IPOBJ routing
 *
 * @class IpobjsRouter
 * 
 */

/**
 * Property  to manage express
 *
 * @property express
 * @type express
 */
var express = require('express');

/**
 * Property  to manage IPOBJ route
 *
 * @property router
 * @type express.Router 
 */
var router = express.Router();

/**
 * Property Model to manage IPOBJ Data
 *
 * @property IpobjlModel
 * @type ../../models/ipobj/ipobj
 * 
 */
var IpobjModel = require('../../models/ipobj/ipobj');

/**
 * Property Model to manage FWC_TREE Data
 *
 * @property fwcTreemodel
 * @type ../../models/tree/fwc_tree
 * 
 */
var fwcTreemodel = require('../../models/tree/tree');

/**
 * Property Model to manage FWC_TREE_NODE Data
 *
 * @property fwc_tree_nodeModel
 * @type ../../models/tree/fwc_tree_node
 * 
 */
var fwc_tree_node = require("../../models/tree/node.js");

/**
 * Property Model to manage UTIL functions
 *
 * @property utilsModel
 * @type ../../models/utils
 * 
 */
var utilsModel = require("../../utils/utils.js");

/**
 * Property Model to manage interface__ipobj data relation
 *
 * @property Interface__ipobjModel
 * @type ../../models/interface/interface__ipobj
 * 
 */
var Interface__ipobjModel = require('../../models/interface/interface__ipobj');

/**
 * Property Model to manage API RESPONSE data
 *
 * @property api_resp
 * @type ../../models/api_response
 * 
 */
var api_resp = require('../../utils/api_response');

/**
 * Property to identify Data Object
 *
 * @property objModel
 * @type text
 */
var objModel = 'IPOBJ';

/**
 * Property Logger to manage App logs
 *
 * @attribute logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");

var Ipobj_typeModel = require('../../models/ipobj/ipobj_type');
var FirewallModel = require('../../models/firewall/firewall');
const duplicityCheck = require('../../middleware/duplicity');
const restrictedCheck = require('../../middleware/restricted');


//FALTA CONTROLAR QUE EL IPOBJ SE INSERTA EN UN NODO PERMITIDO
/**
 * #### Create new ipobj
 * Crea un nuevo objeto en el Cloud que se le pasa.
 * Se le pasa tambien los datos del Nodo en el arbol de navegación para que una vez 
 * añadido el objeto se enlace al nodo del árbol
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj/:node_parent/:node_order/:node_type__      
 * > METHOD:  __POST__
 * 
 * @method NewIpobj
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} node_parent Node parent to insert object
 * @param {Integer} node_order Node order 
 * @param {Integer} node_type Node type
 * 
 * #### POST PARAMETERS
 * 
 * @param {Integer} fwcloud
 * @param {Integer} interface
 * @param {Integer} name
 * @param {Integer} type
 * @param {Integer} protocol
 * @param {Integer} address
 * @param {Integer} netmask
 * @param {Integer} diff_serv
 * @param {Integer} ip_version
 * @param {Integer} code
 * @param {Integer} tcp_flags_mask
 * @param {Integer} tcp_flags_settings
 * @param {Integer} range_start
 * @param {Integer} range_end
 * @param {Integer} source_port_start
 * @param {Integer} source_port_end
 * @param {Integer} destination_port_start
 * @param {Integer} destination_port_end
 * @param {Integer} options
 * @param {Integer} comment
 * 
 * @return {JSON} Returns `JSON` Result
 * * * @example 
 * #### JSON RESPONSE OK:
 *    
 *      {"response": {
 *        "respStatus": true,
 *        "respCode": "ACR_INSERTED_OK",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *      {"response": {
 *        "respStatus": false,
 *        "respCode": "ACR_ERROR",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 * */
router.post("/",
duplicityCheck.ipobj,
(req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var node_parent = req.body.node_parent;
	var node_order = req.body.node_order;
	var node_type = req.body.node_type;

	//Create New objet with data ipobj
	var ipobjData = {
		id: null,
		fwcloud: req.fwcloud,
		interface: req.body.interface,
		name: req.body.name,
		type: req.body.type,
		protocol: req.body.protocol,
		address: req.body.address,
		netmask: req.body.netmask,
		diff_serv: req.body.diff_serv,
		ip_version: req.body.ip_version,
		icmp_code: req.body.icmp_code,
		icmp_type: req.body.icmp_type,
		tcp_flags_mask: req.body.tcp_flags_mask,
		tcp_flags_settings: req.body.tcp_flags_settings,
		range_start: req.body.range_start,
		range_end: req.body.range_end,
		source_port_start: req.body.source_port_start,
		source_port_end: req.body.source_port_end,
		destination_port_start: req.body.destination_port_start,
		destination_port_end: req.body.destination_port_end,
		options: req.body.options,
		comment: req.body.comment
	};

	//GET PROTOCOL NUMBER FROM IPOBJ_TYPE
	Ipobj_typeModel.getIpobj_type(ipobjData.type, function (error, data) {
		if (error)
			api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
		else {
			if (data && data[0].protocol_number !== null) {
				ipobjData.protocol = data[0].protocol_number;
			}
			logger.debug(ipobjData);
			IpobjModel.insertIpobj(ipobjData, (error, data) => {
				if (error)
					api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
				else {
					//If saved ipobj Get data
					if (data && data.insertId > 0)
					{
						IpobjModel.UpdateHOST(data.insertId)
						.then(() => IpobjModel.UpdateINTERFACE(data.insertId))
						.then(() => {
							var id = data.insertId;
							logger.debug("NEW IPOBJ id:" + id + "  Type:" + ipobjData.type + "  Name:" + ipobjData.name);
							ipobjData.id = id;
							//INSERT IN TREE
							fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, ipobjData, (error, data) => {
								if (data && data.insertId) {
									var dataresp = {"insertId": id, "TreeinsertId": data.insertId};
									if (ipobjData.interface) {
										FirewallModel.updateFirewallStatusIPOBJ(fwcloud,id,-1,ipobjData.interface,ipobjData.type,"|3")
										.then(() => FirewallModel.getFirewallStatusNotZero(fwcloud,null))
										.then((not_zero_status_fws) => {
											dataresp.fw_status=not_zero_status_fws;
											api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
										});
									}
									else
										api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
								} else
									api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting TREE NODE IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
							});
						});
					} else
						api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
				}
			});
		}
	});
});



/**
 * #### Update Ipobj
 * Actualiza los datos de un IPOBJ.
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj__      
 * > METHOD:  __PUT__
 * 
 * @method UpdateIpobj
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * 
 * #### POST PARAMETERS
 * 
 * @param {Integer} id
 * @param {Integer} fwcloud
 * @param {Integer} interface
 * @param {Integer} name
 * @param {Integer} type
 * @param {Integer} protocol
 * @param {Integer} address
 * @param {Integer} netmask
 * @param {Integer} diff_serv
 * @param {Integer} ip_version
 * @param {Integer} icmp_code
 * @param {Integer} tcp_flags_mask
 * @param {Integer} tcp_flags_settings
 * @param {Integer} range_start
 * @param {Integer} range_end
 * @param {Integer} source_port_start
 * @param {Integer} source_port_end
 * @param {Integer} destination_port_start
 * @param {Integer} destination_port_end
 * @param {Integer} options
 * @param {Integer} comment
 * 
 * @return {JSON} Returns `JSON` Data from Search
 * * @example 
 * #### JSON RESPONSE OK:
 *    
 *      {"response": {
 *        "respStatus": true,
 *        "respCode": "ACR_UPDATED_OK",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *      {"response": {
 *        "respStatus": false,
 *        "respCode": "ACR_ERROR",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 * */
router.put('/ipobj', 
duplicityCheck.ipobj,
(req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;

	//Save data into object
	var ipobjData = {
		id: req.body.id,
		fwcloud: req.fwcloud, 
		interface: req.body.interface, 
		name: req.body.name, 
		type: req.body.type, 
		protocol: req.body.protocol, 
		address: req.body.address, 
		netmask: req.body.netmask, 
		diff_serv: req.body.diff_serv, 
		ip_version: req.body.ip_version, 
		icmp_code: req.body.icmp_code, 
		icmp_type: req.body.icmp_type, 
		tcp_flags_mask: req.body.tcp_flags_mask, 
		tcp_flags_settings: req.body.tcp_flags_settings, 
		range_start: req.body.range_start, 
		range_end: req.body.range_end, 
		source_port_start: req.body.source_port_start, 
		source_port_end: req.body.source_port_end, 
		destination_port_start: req.body.destination_port_start, 
		destination_port_end: req.body.destination_port_end, 
		options: req.body.options, 
		comment: req.body.comment
	};

	if ((ipobjData.id !== null) && (ipobjData.fwcloud !== null)) {
		Ipobj_typeModel.getIpobj_type(ipobjData.type, (error, data) => {
			if (error)
				api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
			else {
				if (data && data[0].protocol_number !== null)
					ipobjData.protocol = data[0].protocol_number;
				IpobjModel.updateIpobj(ipobjData, (error, data) => {
					if (error)
						api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', objModel, error, jsonResp => res.status(200).json(jsonResp));
					else {
						//If saved ipobj saved ok, get data
						if (data && data.result)
						{
							if (data.result) {
								FirewallModel.updateFirewallStatusIPOBJ(fwcloud,ipobjData.id,-1,-1,ipobjData.type,"|3")
								.then(() => IpobjModel.UpdateHOST(ipobjData.id))
								.then(() => IpobjModel.UpdateINTERFACE(ipobjData.id))
								.then(() => FirewallModel.getFirewallStatusNotZero(fwcloud,null))
								.then((not_zero_status_fws) => {
									logger.debug("UPDATED IPOBJ id:" + ipobjData.id + "  Type:" + ipobjData.type + "  Name:" + ipobjData.name);
											
									//UPDATE TREE            
									fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, ipobjData, (error, data) => {
										if (data && data.result)
											api_resp.getJson(not_zero_status_fws, api_resp.ACR_UPDATED_OK, 'IPOBJ UPDATED OK', objModel, null, jsonResp => res.status(200).json(jsonResp));
										else
											api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating TREE NODE IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
									});
								})
								.catch(error => api_resp.getJson(null, api_resp.ACR_DATA_ERROR, 'Error updating firewall status', 'POLICY', error, jsonResp => res.status(200).json(jsonResp)));
							} else 
								api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Error updating IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
						} else
							api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating IPOBJ', objModel, error, jsonResp => res.status(200).json(jsonResp));
					}
				});
			}
		});
	} else
		api_resp.getJson(null, api_resp.ACR_ERROR, 'Null identifiers', objModel, null, jsonResp => res.status(200).json(jsonResp));
});



/**
 * Get ipobj by Ipobj id
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/:id__      
 * > METHOD:  __GET__
 * 
 * @method getIpobjById
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {JSON} Returns `JSON` Data from Ipobj
 * */
router.put('/get', (req, res) => {
	IpobjModel.getIpobj(req.body.fwcloud, req.body.id, (error, data) =>	{
		//If exists ipobj get data
		if (data && data.length > 0)
			api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		//Get Error
		else
			api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, error, jsonResp => res.status(200).json(jsonResp));
	});
});


/**
 * DELETE IPOBJ
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj/:id/:type__      
 * > METHOD:  __DELETE__
 * 
 *
 * @method DeleteIpobj
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * @param {Integer} type Ipobj type
 * @optional
 * 
 * @return {JSON} Returns Json result
 * @example 
 * #### JSON RESPONSE OK:
 *    
 *      {"response": {
 *        "respStatus": true,
 *        "respCode": "ACR_DELETED_OK",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 *       
 * #### JSON RESPONSE ERROR:
 *    
 *      {"response": {
 *        "respStatus": false,
 *        "respCode": "ACR_ERROR",
 *        "respCodeMsg": "",
 *        "respMsg": "",
 *        "errorCode": "",
 *        "errorMsg": ""
 *      },
 *      "data": {}
 *      };
 */
router.put("/del", 
restrictedCheck.ipobj,  
(req, res) => {
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var id = req.body.id;
	var type = req.body.type;

	FirewallModel.updateFirewallStatusIPOBJ(fwcloud,id,-1,-1,type,"|3")
	.then(() => IpobjModel.UpdateHOST(id))
	.then(() => IpobjModel.UpdateINTERFACE(id))
	.then(() => IpobjModel.deleteIpobj(id, type, fwcloud, (error, data) => {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
		else {
			if (data && (data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted"))
			{
				if (data.msg === "deleted") {
					//DELETE ALL FROM interface_ipobj (INTEFACES UNDER HOST)
					//IF HOST -> DELETE ALL INTERFACE UNDER HOST and ALL IPOBJ UNDER INTERFACES
					// Interface__ipobjModel.deleteInterface(fwcloud, iduser,idinterface , function (error, data)
					//    {});
					//REORDER TREE

					fwcTreemodel.orderTreeNodeDeleted(fwcloud, id, function (error, data) {
						//DELETE FROM TREE
						fwcTreemodel.deleteFwc_Tree(iduser, fwcloud, id, type, function (error, data) {
							FirewallModel.getFirewallStatusNotZero(fwcloud,null)
							.then((not_zero_status_fws) => api_resp.getJson(not_zero_status_fws, api_resp.ACR_DELETED_OK, 'IPOBJ DELETED OK', objModel, null, jsonResp => res.status(200).json(jsonResp)));
						});
					});
				} else if (data.msg === "Restricted")
					api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'IPOBJ restricted to delete', objModel, null, jsonResp => res.status(200).json(jsonResp));
				else
					api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, null, jsonResp => res.status(200).json(jsonResp));
			} else
				api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
		}
	})
	)
	.catch(error => api_resp.getJson(null, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp)));
});


/**
 * Search where ipobj is Used
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj_search_used/:id/:type__      
 * > METHOD:  __GET__
 * 
 * @method SearchIpobjWhereUsed
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * @param {Integer} type Ipobj type
 * 
 * @return {JSON} Returns `JSON` Data from Search
 * */
router.put("/where", (req, res) => {
	//Id from ipobj to remove
	//var idfirewall = req.params.idfirewall;
	var iduser = req.session.user_id;
	var fwcloud = req.body.fwcloud;
	var id = req.body.id;
	var type = req.body.type;

	IpobjModel.searchIpobj(id, type, fwcloud, (error, data) => {
		if (error)
			api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, jsonResp => res.status(200).json(jsonResp));
		else {
			if (data && data.result)
				api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
			else
				api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, jsonResp => res.status(200).json(jsonResp));
		}
	});
});

// API call for check deleting restrictions.
router.put("/restricted",
restrictedCheck.ipobj,
(req, res) => api_resp.getJson(null, api_resp.ACR_OK, '', objModel, null, jsonResp =>res.status(200).json(jsonResp)));

module.exports = router;