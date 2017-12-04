var express = require('express');
var router = express.Router();
var IpobjModel = require('../models/ipobj');
var fwcTreemodel = require('../models/fwc_tree');
var fwc_tree_node = require("../models/fwc_tree_node.js");
var utilsModel = require("../utils/utils.js");
var Interface__ipobjModel = require('../models/interface__ipobj');
var api_resp = require('../utils/api_response');
var objModel = 'IPOBJ';

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");



/* Get all ipobjs by  group*/
router.get('/:iduser/:fwcloud/group/:idgroup', function (req, res)
{
    var idgroup = req.params.idgroup;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    IpobjModel.getAllIpobjsGroup(fwcloud, idgroup, function (error, data)
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

/* Get ipobjs by  group e id*/
router.get('/:iduser/:fwcloud/group/:idgroup/:id', function (req, res)
{
    var idgroup = req.params.idgroup;
    var id = req.params.id;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;

    IpobjModel.getIpobjGroup(fwcloud, idgroup, id, function (error, data)
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


/* Get  ipobj by id  */
router.get('/:iduser/:fwcloud/:id', function (req, res)
{
    var id = req.params.id;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;


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

/* Get all ipobjs by name and by group*/
router.get('/:iduser/:fwcloud/group/:idgroup/name/:name', function (req, res)
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

/* Search ipobj (GROUPS, HOSTS (INTEFACES and IPOBJS)) in Rules */
router.get("/ipobj_search_rules/:iduser/:fwcloud/:id/:type", function (req, res)
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

/* Search where is used ipobj  */
router.get("/ipobj_search_used/:iduser/:fwcloud/:id/:type", function (req, res)
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
/* Create New ipobj */
router.post("/ipobj/:iduser/:fwcloud/:node_parent/:node_order/:node_type", function (req, res)
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



/* Update ipobj that exist */
router.put('/ipobj/:iduser/:fwcloud', function (req, res)
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
        //res.status(500).json({"msg": "Null identifiers"});
        api_resp.getJson(null, api_resp.ACR_ERROR, 'Null identifiers', objModel, null, function (jsonResp) {
            res.status(200).json(jsonResp);
        });
});



/* Remove ipobj */
router.delete("/ipobj/:iduser/:fwcloud/:id/:type", function (req, res)
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