var express = require('express');
var router = express.Router();
var InterfaceModel = require('../models/interface');
var fwcTreemodel = require('../models/fwc_tree');
var fwc_tree_node = require("../models/fwc_tree_node.js");
var utilsModel = require("../utils/utils.js");
var Interface__ipobjModel = require('../models/interface__ipobj');

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/* Get all interfaces by firewall*/
router.get('/:idfirewall/:fwcloud', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var fwcloud = req.params.fwcloud;
    InterfaceModel.getInterfaces(idfirewall, fwcloud, function (error, data)
    {
        //If exists interface get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});

/* Get all interfaces by HOST*/
router.get('/:fwcloud/host/:idhost', function (req, res)
{
    var idhost = req.params.idhost;
    var fwcloud = req.params.fwcloud;
    InterfaceModel.getInterfacesHost(idhost, fwcloud, function (error, data)
    {
        //If exists interface get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});

/* Get  interface by id and  by firewall*/
router.get('/:idfirewall/:fwcloud/interface/:id', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    InterfaceModel.getInterface(idfirewall, fwcloud, id, function (error, data)
    {
        //If exists interface get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});

/* Get all interfaces by nombre and by firewall*/
router.get('/:idfirewall/:fwcloud/name/:name', function (req, res)
{
    var idfirewall = req.params.idfirewall;
    var fwcloud = req.params.fwcloud;
    var name = req.params.name;
    InterfaceModel.getInterfaceName(idfirewall,fwcloud, name, function (error, data)
    {
        //If exists interface get data
        if (typeof data !== 'undefined')
        {
            res.status(200).json({"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});


/* Search where is used interface in RULES  */
router.get("/interface_search_rules/:iduser/:fwcloud/:id/:type", function (req, res)
{
    
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    var type = req.params.type;

    InterfaceModel.searchInterfaceInrules(id, type, fwcloud, function (error, data)
    {
        if (error)
            res.status(500).json({"msg": error});
        else
        if (data)
        {
            res.status(200).json(data);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Search where is used interface  */
router.get("/interface_search_used/:iduser/:fwcloud/:id/:type", function (req, res)
{
    
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var id = req.params.id;
    var type = req.params.type;

    InterfaceModel.searchInterface(id, type, fwcloud, function (error, data)
    {
        if (error)
            res.status(500).json({"msg": error});
        else
        if (data)
        {
            res.status(200).json(data);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});



/* Create New interface */
router.post("/interface/:iduser/:fwcloud/:node_parent/:node_order/:node_type/:host", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
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
            res.status(500).json({"msg": error});
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
                        if (data && data.msg)
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
                        //res.status(200).json({"insertId": data.insertId});
                        res.status(200).json({"insertId": id, "TreeinsertId": data.insertId });
                    } else {
                        logger.debug(error);
                        res.status(500).json({"msg": error});
                    }
                });
            } else
            {
                res.status(500).json({"msg": error});
            }
        }
    });
});

/* Update interface that exist */
router.put('/interface/:iduser/:fwcloud/', function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    //Save data into object
    var interfaceData = {id: req.body.id, name: req.body.name, labelName: req.body.labelName, type: req.body.type, securityLevel: req.body.securityLevel, comment: req.body.comment, mac: req.body.mac};

    utilsModel.checkParameters(interfaceData, function (obj) {
        interfaceData = obj;
    });

    if ((interfaceData.id !== null) && (fwcloud !== null)) {
        InterfaceModel.updateInterface(interfaceData, function (error, data)
        {
            //If saved interface saved ok, get data
            if (data && data.msg)
            {
                if (data.msg === 'success') {
                    interfaceData.type = interfaceData.interface_type;
                    logger.debug("UPDATED INTERFACE id:" + interfaceData.id + "  Type:" + interfaceData.interface_type + "  Name:" + interfaceData.name);
                    //UPDATE TREE            
                    fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, interfaceData, function (error, data) {
                        if (data && data.msg) {
                            res.status(200).json(data.msg);
                        } else {
                            logger.debug(error);
                            res.status(500).json({"msg": error});
                        }
                    });
                } else {
                    logger.debug("TREE NOT UPDATED");
                    res.status(200).json(data.msg);
                }

            } else
            {
                res.status(500).json({"msg": error});
            }
        });
    } else
        res.status(500).json({"msg": "Null identifiers"});

});



/* Remove interface */
router.delete("/interface/:iduser/:fwcloud/:idfirewall/:id/:type", function (req, res)
{
    //Id from interface to remove
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    var idfirewall = req.params.idfirewall;
    var id = req.params.id;
    var type = req.params.type;


    InterfaceModel.deleteInterface(fwcloud, idfirewall, id, type, function (error, data)
    {
        logger.debug(data);
        if (error)
            res.status(500).json({"msg": error});
        else {
            if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted")
            {
                if (data.msg === "deleted") {
                    //DELETE FROM interface_ipobj (INTERFACE UNDER HOST)
                    //DELETE  ALL IPOBJ UNDER INTERFACE
                    Interface__ipobjModel.deleteInterface__ipobj(id,null, function (error, data)
                    {});
                    //DELETE FROM TREE
                    fwcTreemodel.deleteFwc_Tree(iduser, fwcloud, id, type, function (error, data) {
                        if (data && data.msg) {
                            res.status(200).json(data.msg);
                        } else {
                            logger.debug(error);
                            res.status(500).json({"msg": error});
                        }
                    });

                    //DELETE FROM RULES

                } else
                {
                    res.status(500).json(data);
                }
            }
        }
    });
});

module.exports = router;