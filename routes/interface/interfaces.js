var express = require('express');
var router = express.Router();
var InterfaceModel = require('../../models/interface/interface');
var fwcTreemodel = require('../../models/tree/fwc_tree');
var fwc_tree_node = require("../../models/tree/fwc_tree_node.js");
var utilsModel = require("../../utils/utils.js");
var Interface__ipobjModel = require('../../models/interface/interface__ipobj');
var api_resp = require('../../utils/api_response');
var objModel = 'INTERFACE';


var logger = require('log4js').getLogger("app");


/* Get all interfaces by firewall*/
router.get('/:idfirewall/',utilsModel.checkFirewallAccess, function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var fwcloud = req.fwcloud;
    InterfaceModel.getInterfaces(idfirewall, fwcloud, function (error, data)
    {
        //If exists interface get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get all interfaces by HOST*/
router.get('/host/:idhost', function (req, res)
{
    var idhost = req.params.idhost;
    var fwcloud = req.fwcloud;
    InterfaceModel.getInterfacesHost(idhost, fwcloud, function (error, data)
    {
        //If exists interface get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get  interface by id and  by firewall*/
router.get('/:idfirewall/interface/:id',utilsModel.checkFirewallAccess, function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var fwcloud = req.fwcloud;
    var id = req.params.id;
    InterfaceModel.getInterface(idfirewall, fwcloud, id, function (error, data)
    {
        //If exists interface get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

/* Get all interfaces by name and by firewall*/
router.get('/:idfirewall/name/:name',utilsModel.checkFirewallAccess, function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var fwcloud = req.fwcloud;
    var name = req.params.name;
    InterfaceModel.getInterfaceName(idfirewall, fwcloud, name, function (error, data)
    {
        //If exists interface get data
        if (data && data.length > 0)
        {
            api_resp.getJson(data, api_resp.ACR_OK, '', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
        //Get Error
        else
        {
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, ' not found', objModel, null, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});
//FALTA CONTROL de ACCESO a FIREWALLS de FWCLOUD
/* Search where is used interface in RULES  */
router.get("/interface_search_rules/:id/:type",  function (req, res)
{

    var iduser = req.iduser;
    var fwcloud = req.fwcloud;
    var id = req.params.id;
    var type = req.params.type;

    InterfaceModel.searchInterfaceInrules(id, type, fwcloud, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
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
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});

//FALTA CONTROL de ACCESO a FIREWALLS de FWCLOUD
/* Search where is used interface  */
router.get("/interface_search_used/:id/:type", function (req, res)
{

    var iduser = req.iduser;
    var fwcloud = req.fwcloud;
    var id = req.params.id;
    var type = req.params.type;

    InterfaceModel.searchInterface(id, type, fwcloud, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error', objModel, error, function (jsonResp) {
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
            api_resp.getJson(data, api_resp.ACR_NOTEXIST, '', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        }
    });
});


//FALTA COMPROBAR ACCESO FIREWALL
/* Create New interface */
router.post("/interface/:node_parent/:node_order/:node_type/:host", function (req, res)
{
    var iduser = req.iduser;
    var fwcloud = req.fwcloud;
    var node_parent = req.params.node_parent;
    var node_order = req.params.node_order;
    var node_type = req.params.node_type;
    var host = req.params.host;

    if (host === undefined || host === '') {
        host = null;
    }

    //Create New objet with data interface
    var interfaceData = {
        id: null,
        firewall: req.body.firewall,
        name: req.body.name,
        labelName: req.body.labelName,
        type: req.body.type,
        interface_type: req.body.interface_type,
        securityLevel: req.body.securityLevel,
        comment: req.body.comment,
        mac: req.body.mac
    };

    utilsModel.checkParameters(interfaceData, function (obj) {
        interfaceData = obj;
    });

    InterfaceModel.insertInterface(interfaceData, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            //If saved interface Get data
            if (data && data.insertId > 0)
            {
                if (host !== null) {
                    //INSERT INTERFACE UNDER IPOBJ HOST
                    //Create New objet with data interface__ipobj
                    var interface__ipobjData = {
                        interface: data.insertId,
                        ipobj: host,
                        interface_order: 1
                    };

                    Interface__ipobjModel.insertInterface__ipobj(interface__ipobjData, function (error, data)
                    {
                        //If saved interface__ipobj Get data
                        if (data && data.result)
                        {
                            logger.debug("NEW Interface:" + data.insertId + " UNDER HOST:" + host);
                        } else
                        {
                            logger.debug(error);
                        }
                    });
                }
                var id = data.insertId;
                logger.debug("NEW INTERFACE id:" + id + "  Type:" + interfaceData.interface_type + "  Name:" + interfaceData.name);
                interfaceData.id = id;
                interfaceData.type = interfaceData.interface_type;
                //INSERT IN TREE
                fwcTreemodel.insertFwc_TreeOBJ(iduser, fwcloud, node_parent, node_order, node_type, interfaceData, function (error, data) {
                    if (data && data.insertId) {
                        var dataresp = {"insertId": id, "TreeinsertId": data.insertId};
                        api_resp.getJson(dataresp, api_resp.ACR_INSERTED_OK, 'IPOBJ INSERTED OK', objModel, null, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    } else {
                        logger.debug(error);
                        api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    }
                });
            } else
            {
                api_resp.getJson(data, api_resp.ACR_ERROR, 'Error inserting', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

//FALTA COMPROBAR ACCESO FIREWALL
/* Update interface that exist */
router.put('/interface/',  function (req, res)
{
    var iduser = req.iduser;
    var fwcloud = req.fwcloud;
    //Save data into object
    var interfaceData = {id: req.body.id, name: req.body.name, labelName: req.body.labelName, type: req.body.type, securityLevel: req.body.securityLevel, comment: req.body.comment, mac: req.body.mac, interface_type: req.body.interface_type};

    utilsModel.checkParameters(interfaceData, function (obj) {
        interfaceData = obj;
    });

    if ((interfaceData.id !== null) && (fwcloud !== null)) {
        InterfaceModel.updateInterface(interfaceData, function (error, data)
        {
            if (error)
                api_resp.getJson(data, api_resp.ACR_ERROR, 'Error Updating', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            else {
                //If saved interface saved ok, get data
                if (data && data.result)
                {
                    if (data.result) {
                        interfaceData.type = interfaceData.interface_type;
                        logger.debug("UPDATED INTERFACE id:" + interfaceData.id + "  Type:" + interfaceData.interface_type + "  Name:" + interfaceData.name);
                        //UPDATE TREE            
                        fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, interfaceData, function (error, data) {
                            if (data && data.result) {
                                api_resp.getJson(null, api_resp.ACR_UPDATED_OK, 'IPOBJ UPDATED OK', objModel, null, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            } else {
                                api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating TREE', objModel, error, function (jsonResp) {
                                    res.status(200).json(jsonResp);
                                });
                            }
                        });
                    } else {
                        logger.debug("TREE NOT UPDATED");
                        api_resp.getJson(data, api_resp.ACR_ERROR, 'Error updating TREE', objModel, error, function (jsonResp) {
                            res.status(200).json(jsonResp);
                        });
                    }

                } else
                {
                    api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'Error updating Interface', objModel, error, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                }
            }
        });
    } else
        api_resp.getJson(null, api_resp.ACR_DATA_ERROR, 'Error updating', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });

});



/* Remove interface */
router.put("/del/interface/:idfirewall/:id/:type",utilsModel.checkFirewallAccess, function (req, res)
{
    //Id from interface to remove
    var iduser = req.iduser;
    var fwcloud = req.fwcloud;
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    var type = req.params.type;


    InterfaceModel.deleteInterface(fwcloud, idfirewall, id, type, function (error, data)
    {
        if (error)
            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error deleting', objModel, error, function (jsonResp) {
                res.status(200).json(jsonResp);
            });
        else {
            if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted")
            {
                if (data.msg === "deleted") {
                    //DELETE FROM interface_ipobj (INTERFACE UNDER HOST)
                    //DELETE  ALL IPOBJ UNDER INTERFACE
                    Interface__ipobjModel.deleteInterface__ipobj(id, null, function (error, data)
                    {});
                    //DELETE FROM TREE
                    fwcTreemodel.deleteFwc_Tree(iduser, fwcloud, id, type, function (error, data) {
                        if (data && data.result) {
                            api_resp.getJson(null, api_resp.ACR_DELETED_OK, 'INTERFACE DELETED OK', objModel, null, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        } else {
                            logger.debug(error);
                            api_resp.getJson(data, api_resp.ACR_ERROR, 'Error DELETING', objModel, error, function (jsonResp) {
                                res.status(200).json(jsonResp);
                            });
                        }
                    });

                    //DELETE FROM RULES

                } else if (data.msg === "Restricted") {
                    api_resp.getJson(data, api_resp.ACR_RESTRICTED, 'INTERFACE restricted to delete', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                } else {
                    api_resp.getJson(data, api_resp.ACR_NOTEXIST, 'INTERFACE not found', objModel, null, function (jsonResp) {
                        res.status(200).json(jsonResp);
                    });
                }
            } else {
                api_resp.getJson(data, api_resp.ACR_ERROR, '', objModel, error, function (jsonResp) {
                    res.status(200).json(jsonResp);
                });
            }
        }
    });
});

module.exports = router;