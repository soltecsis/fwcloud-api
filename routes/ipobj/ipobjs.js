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
var fwcTreemodel = require('../../models/tree/fwc_tree');

/**
 * Property Model to manage FWC_TREE_NODE Data
 *
 * @property fwc_tree_nodeModel
 * @type ../../models/tree/fwc_tree_node
 * 
 */
var fwc_tree_node = require("../../models/tree/fwc_tree_node.js");

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


/**
 * Get all ipobjs by  group
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/:iduser/:fwcloud/group/:idgroup__      
 * > METHOD:  __GET__
 * 
 * @method getAllIpobjByGroup
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup Group identifier
 * 
 * @return {JSON} Returns `JSON` Data from Ipobj
 * @example #### JSON RESPONSE
 *    
 *     "response": {
 *        "respStatus":         //Response status  TRUE | FALSE
 *        "respCode":           //Response Code 
 *        "respCodeMsg":        //Response message
 *        "respMsg":            //Response custom message
 *        "errorCode":          //Error code
 *        "errorMsg":           //Error message
 *          },
 *     "data": [                //Data node with de IPOBJ DATA
 *        { "id": 1488,
 *            "name": "PC-AALMODOVAR",
 *            "type": 8,
 *            "fwcloud": 1,
            "interface": null,
            "protocol": null,
            "address": null,
            "netmask": null,
            "diff_serv": null,
            "ip_version": null,
            "code": null,
            "tcp_flags_mask": null,
            "tcp_flags_settings": null,
            "range_start": null,
            "range_end": null,
            "source_port_start": null,
            "source_port_end": null,
            "destination_port_start": null,
            "destination_port_end": null,
            "options": null,
            "comment": "",
            "id_node": 102,
            "id_parent_node": 8,
            "interfaces": [         //Interface Node with Interfaces 
                {
                    "id": 73,
                    "firewall": null,
                    "name": "eth0",
                    "labelname": "eth0",
                    "type": "11",
                    "securityLevel": "0",
                    "interface_type": 11,
                    "comment": null,
                    "id_node": 318,
                    "id_parent_node": 102,
                    "ipobjs": [     //Ipobj Node with ipobjs into Interface
                        {
                            "id": 1525,
                            "name": "PC-AALMODOVAR:eth0",
                            "type": 5,
                            "fwcloud": 1,
                            "interface": 73,
                            "protocol": null,
                            "address": "10.98.1.16",
                            "netmask": "255.255.255.0",
                            "diff_serv": null,
                            "ip_version": "IPv4",
                            "code": null,
                            "tcp_flags_mask": null,
                            "tcp_flags_settings": null,
                            "range_start": null,
                            "range_end": null,
                            "source_port_start": null,
                            "source_port_end": null,
                            "destination_port_start": null,
                            "destination_port_end": null,
                            "options": null,
                            "comment": "",
                            "id_node": 339,
                            "id_parent_node": 318
                        },
                    ]
                },
            ]
        }
        ]
        }
 * 
 */
router.get('/:iduser/:fwcloud/group/:idgroup',utilsModel.checkFwCloudAccess(false), function (req, res)
{
    var idgroup = req.params.idgroup;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    IpobjModel.getAllIpobjsGroup(fwcloud, idgroup, function (error, data)
    {
        //If exists ipobj get data
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/**
 * Get ipobj by  group and Ipobj id
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/:iduser/:fwcloud/group/:idgroup/:id__      
 * > METHOD:  __GET__
 * 
 * @method getIpobjByGroup
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup Group identifier
 * @param {Integer} id Ipobj identifier
 * 
 * @return {JSON} Returns `JSON` Data from Ipobj
 * */
router.get('/:iduser/:fwcloud/group/:idgroup/:id',utilsModel.checkFwCloudAccess(false), function (req, res)
{
    var idgroup = req.params.idgroup;
    var id = req.params.id;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    IpobjModel.getIpobjGroup(fwcloud, idgroup, id, function (error, data)
    {
        //If exists ipobj get data
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


/**
 * Get ipobj by Ipobj id
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/:iduser/:fwcloud/:id__      
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
router.get('/:iduser/:fwcloud/:id',utilsModel.checkFwCloudAccess(false), function (req, res)
{
    var id = req.params.id;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    logger.debug("Req Access: " + req.fwc_access);
    

    IpobjModel.getIpobj(fwcloud, id, function (error, data)
    {
        //If exists ipobj get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });

        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/**
 * Get all ipobjs by name and by group
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/:iduser/:fwcloud/group/:idgroup/name/:name__      
 * > METHOD:  __GET__
 * 
 * @method getAllIpobjByGroupName
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} idgroup Group identifier
 * @param {String} name Ipobj name
 * 
 * @return {JSON} Returns `JSON` Data from Ipobj
 * */
router.get('/:iduser/:fwcloud/group/:idgroup/name/:name',utilsModel.checkFwCloudAccess(false), function (req, res)
{
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    IpobjModel.getIpobjName(fwcloud, idgroup, name, function (error, data)
    {
        //If exists ipobj get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', null, objModel, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/**
 * Search where ipobj (GROUPS, HOSTS (INTEFACES and IPOBJS)) in Rules
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj_search_rules/:iduser/:fwcloud/:id/:type__      
 * > METHOD:  __GET__
 * 
 * @method SearchIpobjInRules
 * 
 * @param {Integer} iduser User identifier
 * @param {Integer} fwcloud FwCloud identifier
 * @param {Integer} id Ipobj identifier
 * @param {Integer} type Ipobj type
 * 
 * @return {JSON} Returns `JSON` Data from Search
 * */
router.get("/ipobj_search_rules/:iduser/:fwcloud/:id/:type",utilsModel.checkFwCloudAccess(false), function (req, res)
{
    //Id from ipobj to remove
    //var idfirewall = req.params.idfirewall;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    var type = req.params.type;


    IpobjModel.searchIpobjInRules(id, type, fwcloud, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/**
 * Search where ipobj is Used
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj_search_used/:iduser/:fwcloud/:id/:type__      
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
router.get("/ipobj_search_used/:iduser/:fwcloud/:id/:type",utilsModel.checkFwCloudAccess(false), function (req, res)
{
    //Id from ipobj to remove
    //var idfirewall = req.params.idfirewall;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    var type = req.params.type;

    IpobjModel.searchIpobj(id, type, fwcloud, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else
        if (data && data.result)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        } else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


//FALTA CONTROLAR QUE EL IPOBJ SE INSERTA EN UN NODO PERMITIDO
/**
 * #### Create new ipobj
 * Crea un nuevo objeto en el Cloud que se le pasa.
 * Se le pasa tambien los datos del Nodo en el arbol de navegación para que una vez 
 * añadido el objeto se enlace al nodo del árbol
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj/:iduser/:fwcloud/:node_parent/:node_order/:node_type__      
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
router.post("/ipobj/:iduser/:fwcloud/:node_parent/:node_order/:node_type",utilsModel.checkFwCloudAccess(true), function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var node_parent = req.params.node_parent;
    var node_order = req.params.node_order;
    var node_type = req.params.node_type;


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
        code: req.body.code,
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


    utilsModel.checkParameters(ipobjData, function (obj) {
        ipobjData = obj;
    });


    IpobjModel.insertIpobj(ipobjData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved ipobj Get data
            if (data && data.insertId > 0)
            {
                var id = data.insertId;
                logger.debug("NEW IPOBJ id:" + id + "  Type:" + ipobjData.type + "  Name:" + ipobjData.name);
                ipobjData.id = id;
                //INSERT IN TREE
                fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, ipobjData, function (error, data) {
                    if (data && data.insertId) {
                        //res.status(200).json({"insertId": id, "TreeinsertId": data.insertId});
                        var dataresp = {"insertId": id, "TreeinsertId": data.insertId};
                        api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });

                    } else {
                        api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting TREE NODE IPOBJ', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    }
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_DATA_ERROR, 'Error inserting IPOBJ', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });

});



/**
 * #### Update Ipobj
 * Actualiza los datos de un IPOBJ.
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj/:iduser/:fwcloud__      
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
router.put('/ipobj/:iduser/:fwcloud',utilsModel.checkFwCloudAccess(true), function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    //Save data into object
    var ipobjData = {id: req.body.id, fwcloud: req.body.fwcloud, interface: req.body.interface, name: req.body.name, type: req.body.type, protocol: req.body.protocol, address: req.body.address, netmask: req.body.netmask, diff_serv: req.body.diff_serv, ip_version: req.body.ip_version, code: req.body.code, tcp_flags_mask: req.body.tcp_flags_mask, tcp_flags_settings: req.body.tcp_flags_settings, range_start: req.body.range_start, range_end: req.body.range_end, source_port_start: req.body.source_port_start, source_port_end: req.body.source_port_end, destination_port_start: req.body.destination_port_start, destination_port_end: req.body.destination_port_end, options: req.body.options, comment: req.body.comment};

    utilsModel.checkParameters(ipobjData, function (obj) {
        ipobjData = obj;
    });


    if ((ipobjData.id !== null) && (ipobjData.fwcloud !== null)) {
        IpobjModel.updateIpobj(ipobjData, function (error, data)
        {
            if (error)
                api_resp.getJson(data, api_resp.ACR_ERROR, 'SQL ERRROR', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            else {
                //If saved ipobj saved ok, get data
                if (data && data.result)
                {
                    if (data.result) {
                        logger.debug("UPDATED IPOBJ id:" + ipobjData.id + "  Type:" + ipobjData.type + "  Name:" + ipobjData.name);
                        //UPDATE TREE            
                        fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, ipobjData, function (error, data) {
                            if (data && data.result) {
                                api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'IPOBJ UPDATED OK', objModel, null, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            } else {
                                api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating TREE NODE IPOBJ', objModel, error, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            }
                        });
                    } else {
                        api_resp.getJson(null, api_resp.ACR_NOTEXIST, 'Error updating IPOBJ', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    }

                } else
                {
                    api_resp.getJson(null, api_resp.ACR_ERROR, 'Error updating IPOBJ', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                }
            }
        });
    } else
        api_resp.getJson(null, api_resp.ACR_ERROR, 'Null identifiers', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
});



/**
 * DELETE IPOBJ
 * 
 * 
 * > ROUTE CALL:  __/ipobjs/ipobj/:iduser/:fwcloud/:id/:type__      
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
router.put("/del/ipobj/:iduser/:fwcloud/:id/:type",utilsModel.checkFwCloudAccess(true), function (req, res)
{
    //Id from ipobj to remove
    //var idfirewall = req.params.idfirewall;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    var type = req.params.type;

    IpobjModel.deleteIpobj(id, type, fwcloud, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
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
                            if (data && data.result) {
                                api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'IPOBJ DELETED OK', objModel, null, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            } else {
                                api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'TREE NODE Error updating', 'TREE NODE', null, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            }
                        });
                    });
                } else if (data.msg === "Restricted") {
                    api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'IPOBJ restricted to delete', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else {
                    api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'IPOBJ not found', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                }
            } else
            {
                api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

module.exports = router;