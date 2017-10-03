var express = require('express');
var router = express.Router();
var IpobjModel = require('../models/ipobj');
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

/* Show form */
router.get('/ipobj', function (req, res)
{
    res.render('new_ipobj', {title: 'Crear nuevo ipobj'});
});

/* Get all ipobjs by  group*/
router.get('/group/:idgroup', function (req, res)
{
    var idgroup = req.params.idgroup;
    IpobjModel.getIpobjsGroup(idgroup, function (error, data)
    {
        //If exists ipobj get data
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

/* Get all ipobjs by  group e id*/
router.get('/group/:idgroup/:id', function (req, res)
{
    var idgroup = req.params.idgroup;
    var id = req.params.id;

    IpobjModel.getIpobjsGroup(idgroup, id, function (error, data)
    {
        //If exists ipobj get data
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


/* Get  ipobj by id  */
router.get('/:id', function (req, res)
{
    var id = req.params.id;
    IpobjModel.getIpobj(id, function (error, data)
    {
        //If exists ipobj get data
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

/* Get all ipobjs by nombre and by group*/
router.get('/group/:idgroup/name/:name', function (req, res)
{
    var name = req.params.name;
    var idgroup = req.params.idgroup;
    IpobjModel.getIpobjName(idgroup, name, function (error, data)
    {
        //If exists ipobj get data
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
            res.status(500).json({"msg": error});
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
                        res.status(200).json({"insertId": data.insertId});
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
                res.status(500).json({"msg": error});
            else {
                //If saved ipobj saved ok, get data
                if (data && data.msg)
                {
                    if (data.msg === 'success') {
                        logger.debug("UPDATED IPOBJ id:" + ipobjData.id + "  Type:" + ipobjData.type + "  Name:" + ipobjData.name);
                        //UPDATE TREE            
                        fwcTreemodel.updateFwc_Tree_OBJ(iduser, fwcloud, ipobjData, function (error, data) {
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
                    logger.debug(error);
                    res.status(500).json({"msg": error});
                }
            }
        });
    } else
        res.status(500).json({"msg": "Null identifiers"});
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
            res.status(500).json({"msg": error});
        else
        if (data && data.msg === "deleted" || data.msg === "notExist" || data.msg === "Restricted")
        {
            if (data.msg === "deleted") {
                //DELETE ALL FROM interface_ipobj (INTEFACES UNDER HOST)
                //IF HOST -> DELETE ALL INTERFACE UNDER HOST and ALL IPOBJ UNDER INTERFACES

                // Interface__ipobjModel.deleteInterface(fwcloud, iduser,idinterface , function (error, data)
                //    {});
                //REORDER TREE

                fwcTreemodel.orderTreeNodeDeleted( fwcloud, id, function (error, data) {
                    //DELETE FROM TREE
                    fwcTreemodel.deleteFwc_Tree(iduser, fwcloud, id, type, function (error, data) {
                        if (data && data.msg) {
                            res.status(200).json(data.msg);
                        } else {
                            logger.debug(error);
                            res.status(500).json({"msg": error});
                        }
                    });
                });

                //DELETE FROM RULES
            } else
                res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

module.exports = router;