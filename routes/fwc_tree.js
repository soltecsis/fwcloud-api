var express = require('express');
var router = express.Router();
var fwcTreemodel = require('../models/fwc_tree');
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node = require("../models/fwc_tree_node.js");

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
router.get('/firewalls/:iduser', function (req, res)
{
    var iduser = req.params.iduser;

    fwcTreemodel.getFwc_TreeUserFolder(iduser, "FDF", function (error, rows)
    {
        if (typeof rows !== 'undefined' && rows.length > 0)
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);

            //console.log(root_node);
            var tree = new Tree(root_node);

            fwcTreemodel.getFwc_TreeUserFull(iduser, root_node.id, tree, 1, 1, function (error, data)
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




/* Get all fwc_tree NODE OBJECTS by User*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.get('/objects/user/:iduser/:standard/:fwcloud/', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.standard;
    var objc = req.params.fwcloud;

    fwcTreemodel.getFwc_TreeUserFolder(iduser, "FDO", function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);


            var tree = new Tree(root_node);

            fwcTreemodel.getFwc_TreeUserFull(iduser, root_node.id, tree, objs, objc, function (error, data)
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

/* Get fwc_tree NODE OBJECTS by User snd by ID*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.get('/objects/user/:iduser/:standard/:fwcloud/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.standard;
    var objc = req.params.fwcloud;
    var idNode = req.params.id;

    fwcTreemodel.getFwc_TreeId(iduser, idNode, function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);


            var tree = new Tree(root_node);

            fwcTreemodel.getFwc_TreeUserFull(iduser, root_node.id, tree, objs, objc, function (error, data)
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
router.get('/services/user/:iduser/:standard/:fwcloud/', function (req, res)
{
    var iduser = req.params.iduser;
    var objs = req.params.standard;
    var objc = req.params.fwcloud;

    fwcTreemodel.getFwc_TreeUserFolder(iduser, "FDS", function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row = rows[0];
            //create object
            var root_node = new fwc_tree_node(row);


            var tree = new Tree(root_node);

            fwcTreemodel.getFwc_TreeUserFull(iduser, root_node.id, tree, objs, objc, function (error, data)
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
router.get('/:iduser/:id', function (req, res)
{
    var iduser = req.params.iduser;
    var id = req.params.id;
    fwcTreemodel.getFwc_TreeId(iduser, id, function (error, data)
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
router.get('/:iduser/name/:name', function (req, res)
{
    var name = req.params.name;
    var iduser = req.params.iduser;
    fwcTreemodel.getFwc_TreeName(iduser, name, function (error, data)
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
router.get("/create-firewalls/user/:iduser", function (req, res)
{
    var iduser = req.params.iduser;

    fwcTreemodel.insertFwc_Tree_firewalls(iduser, "FDF", function (error, data)
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
router.get("/create-objects/user/:iduser", function (req, res)
{
    var iduser = req.params.iduser;

    fwcTreemodel.insertFwc_Tree_objects(iduser, "FDO", function (error, data)
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
router.get("/create-services/user/:iduser", function (req, res)
{
    var iduser = req.params.iduser;

    fwcTreemodel.insertFwc_Tree_objects(iduser, "FDS", function (error, data)
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