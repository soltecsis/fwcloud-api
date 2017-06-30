var express = require('express');
var router = express.Router();
var fwcTreemodel = require('../models/fwc_tree');
//var Node = require("tree-node");
var Tree = require('easy-tree');
var fwc_tree_node= require("../models/fwc_tree_node.js");


/* Show form */
router.get('/fwc_tree', function (req, res)
{
    res.render('new_fwc_tree', {title: 'Crear nuevo fwc_tree'});
});

/* Get all fwc_tree NODE FIREWALL by User*/
router.get('/firewalls/:iduser', function (req, res)
{
    var iduser = req.params.iduser;

    fwcTreemodel.getFwc_TreeUserFolder(iduser,"FDF", function (error, rows)
    {
        if (typeof rows !== 'undefined'  && rows.length>0)
        {
            var row=rows[0];
            //create object
            var root_node = new fwc_tree_node(row);
            
            //console.log(root_node);
            var tree = new Tree(root_node);

            fwcTreemodel.getFwc_TreeUserFull(iduser, root_node.id, tree, function (error, data)
            {
                //If exists fwc_tree get data
                if (typeof data !== 'undefined')
                {                    
                    res.json(200, {"data": data});
                }
                //Get Error
                else
                {
                    res.json(404, {"msg": "notExist"});
                }
            });
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});


/* Get all fwc_tree NODE OBJECTS by User*/
//objs -> Standar objects (without fwcloud)
//objc -> fwcloud objects
router.get('/objects/:objs/:objc/:iduser', function (req, res)
{
    var iduser = req.params.iduser;
    var get_objs = req.params.objs;
    var get_objc = req.params.objc;

    fwcTreemodel.getFwc_TreeUserFolder(iduser,"FDO",function (error, rows)
    {
        if (typeof rows !== 'undefined')
        {
            var row=rows[0];
            //create object
            var root_node = new fwc_tree_node(row);
            
            
            var tree = new Tree(root_node);

            fwcTreemodel.getFwc_TreeUserFull(iduser, root_node.id, tree, function (error, data)
            {
                //If exists fwc_tree get data
                if (typeof data !== 'undefined')
                {                    
                    res.json(200, data);
                }
                //Get Error
                else
                {
                    res.json(404, {"msg": "notExist"});
                }
            });
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
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
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
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
            res.json(200, data);
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});





/* Create New fwc_tree */
router.post("/fwc_tree", function (req, res)
{
    //Create New objet with data fwc_tree
    var fwc_treeData = {
        id: null,
        fwcloud: req.body.fwcloud,

    };

    fwcTreemodel.insertFwc_Tree(fwc_treeData, function (error, data)
    {
        //If saved fwc_tree Get data
        if (data && data.insertId)
        {
            //res.redirect("/fwc_tree/fwc_tree/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update fwc_tree that exist */
router.put('/fwc_tree/', function (req, res)
{
    //Save data into object
    var fwc_treeData = {id: req.param('id'), fwcloud: req.param('fwcloud'), interface: req.param('interface'), name: req.param('name'), type: req.param('type'), protocol: req.param('protocol'), address: req.param('address'), netmask: req.param('netmask'), diff_serv: req.param('diff_serv'), ip_version: req.param('ip_version'), code: req.param('code'), tcp_flags_mask: req.param('tcp_flags_mask'), tcp_flags_settings: req.param('tcp_flags_settings'), range_start: req.param('range_start'), range_end: req.param('range_end'), source_port_start: req.param('source_port_start'), source_port_end: req.param('source_port_end'), destination_port_start: req.param('destination_port_start'), destination_port_end: req.param('destination_port_end'), options: req.param('options'), comment: req.param('comment')};
    fwcTreemodel.updateIpobj(fwc_treeData, function (error, data)
    {
        //If saved fwc_tree saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/fwc_tree/fwc_tree/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove fwc_tree */
router.delete("/fwc_tree/", function (req, res)
{
    //Id from fwc_tree to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    fwcTreemodel.deleteIpobj(idfirewall, id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/fwc_tree/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;