/*
    Copyright 2019 SOLTECSIS SOLUCIONES TECNOLOGICAS, SLU
    https://soltecsis.com
    info@soltecsis.com


    This file is part of FWCloud (https://fwcloud.net).

    FWCloud is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    FWCloud is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with FWCloud.  If not, see <https://www.gnu.org/licenses/>.
*/


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
import { IPObj } from '../../models/ipobj/IPObj';

/**
 * Property Model to manage FWC_TREE Data
 *
 * @property fwcTreemodel
 * @type ../../models/tree/fwc_tree
 * 
 */
import { Tree } from '../../models/tree/Tree';


import { IPObjType } from '../../models/ipobj/IPObjType';
import { Firewall } from '../../models/firewall/Firewall';
import { OpenVPN } from '../../models/vpn/openvpn/OpenVPN';
import { logger } from '../../fonaments/abstract-application';
import { WireGuard } from '../../models/vpn/wireguard/WireGuard';
const duplicityCheck = require('../../middleware/duplicity');
const restrictedCheck = require('../../middleware/restricted');
const fwcError = require('../../utils/error_table');



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
	async(req, res) => {
		var fwcloud = req.body.fwcloud;
		var node_parent = req.body.node_parent;
		var node_order = req.body.node_order;
		var node_type = req.body.node_type;

		//Create New objet with data ipobj
		var ipobjData = {
			id: null,
			fwcloud: req.body.fwcloud,
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

		try {
			const id = await IPObj.insertIpobj(req.dbCon, ipobjData);
			await IPObj.UpdateHOST(id);
			await IPObj.UpdateINTERFACE(id);

			//INSERT IN TREE
			const node_id = (node_parent) ? await Tree.insertFwc_TreeOBJ(req, node_parent, node_order, node_type, ipobjData) : 0;

			var dataresp = { "insertId": id, "TreeinsertId": node_id };
			if (ipobjData.interface) {
				await Firewall.updateFirewallStatusIPOBJ(fwcloud, [id]);
				dataresp.fw_status = await Firewall.getFirewallStatusNotZero(fwcloud, null);
			}

			res.status(200).json(dataresp);
		} catch (error) {
			logger().error('Error creating an ipobj: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
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
router.put('/',
	duplicityCheck.ipobj,
	async(req, res) => {
		//Save data into object
		var ipobjData = {
			id: req.body.id,
			fwcloud: req.body.fwcloud,
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

		try {
			const data = await IPObjType.getIpobj_type(req, ipobjData.type);

			if (data && data[0].protocol_number !== null)
				ipobjData.protocol = data[0].protocol_number;

			await IPObj.updateIpobj(req, ipobjData);
			await Firewall.updateFirewallStatusIPOBJ(req.body.fwcloud, [ipobjData.id]);

			if (req.body.options && req.body.options.find(option => option.name === "Address")) {	
				await WireGuard.updateWireGuardStatusIPOBJ(req, ipobjData.id, "|1");
			} else {
				await OpenVPN.updateOpenvpnStatusIPOBJ(req, ipobjData.id, "|1");
			}

			await IPObj.UpdateHOST(ipobjData.id);
			await IPObj.UpdateINTERFACE(ipobjData.id);

			var data_return = {};
			await Firewall.getFirewallStatusNotZero(req.body.fwcloud, data_return);
			
			if (req.body.options && req.body.options.find(option => option.name === "Address")) {
				await WireGuard.getWireGuardStatusNotZero(req, data_return);
			} else {
				await OpenVPN.getOpenvpnStatusNotZero(req, data_return);
			}

			await Tree.updateFwc_Tree_OBJ(req, ipobjData); //UPDATE TREE    

			res.status(200).json(data_return);
		} catch (error) {
			logger().error('Error updating an ipobj: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
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
router.put('/get', async(req, res) => {
	try {
		const data = await IPObj.getIpobj(req.dbCon, req.body.fwcloud, req.body.id);
		if (data && data.length == 1)
			res.status(200).json(data[0]);
		else
			res.status(400).json(fwcError.NOT_FOUND);
	} catch (error) {
		logger().error('Error finding an ipobj: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
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
router.put('/del',
	restrictedCheck.ipobj,
	async(req, res) => {
		var fwcloud = req.body.fwcloud;
		var id = req.body.id;
		var type = req.body.type;

		try {
			await Firewall.updateFirewallStatusIPOBJ(fwcloud, [id]);
			await IPObj.UpdateHOST(id);
			await IPObj.UpdateINTERFACE(id);

			if (type === 8)
				await IPObj.deleteHost(req.dbCon, req.body.fwcloud, req.body.id);
			else
				await IPObj.deleteIpobj(req.dbCon, req.body.fwcloud, req.body.id);

			await Tree.orderTreeNodeDeleted(req.dbCon, fwcloud, id);
			//DELETE FROM TREE
			await Tree.deleteObjFromTree(fwcloud, id, type);
			const not_zero_status_fws = await Firewall.getFirewallStatusNotZero(fwcloud, null);
			res.status(200).json(not_zero_status_fws);
		} catch (error) {
			logger().error('Error removing an ipobj: ' + JSON.stringify(error));
			res.status(400).json(error);
		}
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
router.put('/where', async(req, res) => {
	try {
		const data = await IPObj.searchIpobjUsage(req.dbCon, req.body.fwcloud, req.body.id, req.body.type);
		if (data.result)
			res.status(200).json(data);
		else
			res.status(204).end();
	} catch (error) {
		logger().error('Error ipobj references: ' + JSON.stringify(error));
		res.status(400).json(error);
	}
});

// API call for check deleting restrictions.
router.put('/restricted', restrictedCheck.ipobj, (req, res) => res.status(204).end());


module.exports = router;