var express = require('express');
var router = express.Router();
var fwcTreemodel = require('../models/fwc_tree');
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("../models/fwc_tree_node.js");
var utilsModel = require("../utils/utils.js");

/**
 * Property Logger to manage App logs
 *
 * @property logger
 * @type log4js/app
 * 
 */
var logger = require('log4js').getLogger("app");


/* Show form */
//router.get('/fwc-tree', function (req, res)
//{
//    res.render('new_fwc_tree', {title: 'Crear nuevo fwc_tree'});
//});


/* Get all fwc_tree NODE FIREWALL by User*/
router.get('/firewalls/:iduser/:fwcloud', function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.getFwc_TreeUserFolder(iduser, fwcloud, "FDF", function (error, rows)
    {
        utilsModel.checkEmptyRow(rows, function (notempty)
        {
            if (notempty) {
                var row = rows[0];
                //create object
                var root_node = new fwc_tree_node(row);
                //console.log(root_node);
                var tree = new Tree(root_node);
                fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, 1, 1,"FDF", function (error, data)
                {
                    //If exists fwc_tree get data
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
            }
            else{
                res.status(404).json({"msg": "notExist"});
            }
        });


    });
});
/* Get all fwc_tree NODE OBJECTS by User*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.get('/objects/user/:iduser/fwc/:fwcloud/:objStandard/:objCloud/', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.objStandard;
    var objc = req.params.objCloud;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.getFwc_TreeUserFolder(iduser,fwcloud, "FDO", function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);
            var tree = new Tree(root_node);
                                            //(iduser, fwcloud, idparent, tree, objStandard, objCloud,node_type, AllDone)
            fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, objs, objc,"FDO" ,function (error, data)
            {
                //If exists fwc_tree get data
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
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});
/* Get fwc_tree NODE OBJECTS by User and by ID*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.get('/objects/user/:iduser/fwc/:fwcloud/:objStandard/:objCloud/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.objStandard;
    var objc = req.params.objCloud;
    var idNode = req.params.id;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.getFwc_TreeId(iduser, fwcloud, idNode, function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);
            var tree = new Tree(root_node);
            fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, objs, objc,"FDO", function (error, data)
            {
                //If exists fwc_tree get data
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
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});
/* Get all fwc_tree NODE SERVICES by User*/
//objs -> Standar services (without fwcloud)
//objc -> fwcloud services
router.get('/services/user/:iduser/fwc/:fwcloud/:objStandard/:objCloud', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.objStandard;
    var objc = req.params.objCloud;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.getFwc_TreeUserFolder(iduser,fwcloud, "FDS", function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);
            var tree = new Tree(root_node);
            fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, objs, objc,"FDS", function (error, data)
            {
                //If exists fwc_tree get data
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
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});
/* Get all fwc_tree NODE SERVICES by User*/
//objs -> Standar services (without fwcloud)
//objc -> fwcloud services
router.get('/services/user/:iduser/fwc/:fwcloud/:objStandard/:objCloud/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.objStandard;
    var objc = req.params.objCloud;
    var fwcloud = req.params.fwcloud;
    var idNode = req.params.id;
    fwcTreemodel.getFwc_TreeId(iduser,fwcloud, idNode, function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);
            var tree = new Tree(root_node);
            fwcTreemodel.getFwc_TreeUserFull(iduser, fwcloud, root_node.id, tree, objs, objc,"FDS", function (error, data)
            {
                //If exists fwc_tree get data
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
        }
        //Get Error
        else
        {
            res.status(404).json({"msg": "notExist"});
        }
    });
});
/* Get  fwc_tree by id  */
router.get('/:iduser/:fwcloud/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var id = req.params.id;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.getFwc_TreeId(iduser, fwcloud, id, function (error, data)
    {
        //If exists fwc_tree get data
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
/* Get all fwc_tree by name */
router.get('/:iduser/:fwcloud/name/:name', function (req, res)
{
    var name = req.params.name;
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.getFwc_TreeName(fwcloud, name, function (error, data)
    {
        //If exists fwc_tree get data
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
/* Create New fwc_tree Firewall node*/
router.get("/create-firewalls/user/:iduser/:fwcloud", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.insertFwc_Tree_firewalls(fwcloud, "FDF", function (error, data)
    {
        //If saved fwc-tree Get data
        if (data && data.msg)
        {
            res.status(200).json({"msg": data.msg});
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});
/* Create New fwc_tree Objects*/
router.get("/create-objects/user/:iduser/:fwcloud", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.insertFwc_Tree_objects(fwcloud, "FDO", function (error, data)
    {
        //If saved fwc-tree Get data
        if (data && data.msg)
        {
            res.status(200).json({"msg": data.msg});
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});
/* Create New fwc_tree Services*/
router.get("/create-services/user/:iduser/:fwcloud", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    fwcTreemodel.insertFwc_Tree_objects(fwcloud, "FDS", function (error, data)
    {
        //If saved fwc-tree Get data
        if (data && data.msg)
        {
            res.status(200).json({"msg": data.msg});
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});
//FALTA AÑADIR CONTROL ACCESO ADMIN
/* Create ALL nodes*/
router.get("/create-ALL/user/:iduser/:fwcloud", function (req, res)
{
    var iduser = req.params.iduser;
    var fwcloud = req.params.fwcloud;
    //AÑADIR CONTROL de ACCESO de USUARIO a FWCLOUD

    logger.debug("------------- CREATING FWCTREE INIT");
    fwcTreemodel.insertFwc_Tree_init(fwcloud, function (error, data)
    {
        //If saved fwc-tree Get data
        if (data && data.msg)
        {
            logger.debug("------------- CREATING FWCTREE FIREWALLS");
            fwcTreemodel.insertFwc_Tree_firewalls(fwcloud, "FDF", function (error, data)
            {
                //If saved fwc-tree Get data
                if (data && data.msg)
                {
                    logger.debug("------------- CREATING FWCTREE OBJECTS");
                    fwcTreemodel.insertFwc_Tree_objects(fwcloud, "FDO", function (error, data)
                    {
                        //If saved fwc-tree Get data
                        if (data && data.msg)
                        {
                            logger.debug("------------- CREATING FWCTREE SERVICES");
                            fwcTreemodel.insertFwc_Tree_objects(fwcloud, "FDS", function (error, data)
                            {
                                //If saved fwc-tree Get data
                                if (data && data.msg)
                                {
                                    res.status(200).json({"msg": data.msg});
                                } else
                                {
                                    res.status(500).json({"msg": error});
                                }
                            });
                        } else
                        {
                            res.status(500).json({"msg": error});
                        }
                    });
                } else
                {
                    res.status(500).json({"msg": error});
                }
            });
        }
    });
});
///FALTA ACABAR
/* Update fwc_tree that exist */
router.put('/fwc-tree/', function (req, res)
{
    //Save data into object
    var fwc_treeData = {id: req.param('id'), fwcloud: req.param('fwcloud'), interface: req.param('interface'), name: req.param('name'), type: req.param('type'), protocol: req.param('protocol'), address: req.param('address'), netmask: req.param('netmask'), diff_serv: req.param('diff_serv'), ip_version: req.param('ip_version'), code: req.param('code'), tcp_flags_mask: req.param('tcp_flags_mask'), tcp_flags_settings: req.param('tcp_flags_settings'), range_start: req.param('range_start'), range_end: req.param('range_end'), source_port_start: req.param('source_port_start'), source_port_end: req.param('source_port_end'), destination_port_start: req.param('destination_port_start'), destination_port_end: req.param('destination_port_end'), options: req.param('options'), comment: req.param('comment')};
    fwcTreemodel.updateIpobj(fwc_treeData, function (error, data)
    {
        //If saved fwc_tree saved ok, get data
        if (data && data.msg)
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});
//FALTA ACABAR
/* Remove fwc_tree */
router.delete("/fwc-tree/", function (req, res)
{
    //Id from fwc_tree to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    fwcTreemodel.deleteIpobj(idfirewall, id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/fwc_tree/");
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});
module.exports = router;