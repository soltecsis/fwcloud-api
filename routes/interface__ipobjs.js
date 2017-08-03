var express = require('express');
var router = express.Router();
var Interface__ipobjModel = require('../models/interface__ipobj');


/* Show form */
router.get('/interface__ipobj', function (req, res)
{
    res.render('new_interface__ipobj', {title: 'Crear nuevo interface__ipobj'});
});

/* Get all interface__ipobjs by interface*/
router.get('/interface/:interface', function (req, res)
{
    var interface = req.params.interface;
    Interface__ipobjModel.getInterface__ipobjs_interface(interface,function (error, data)
    {
        //If exists interface__ipobj get data
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
});

/* Get all interface__ipobjs by ipobj*/
router.get('/ipobj/:ipobj', function (req, res)
{
    var ipobj = req.params.ipobj;
    Interface__ipobjModel.getInterface__ipobjs_ipobj(ipobj,function (error, data)
    {
        //If exists interface__ipobj get data
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
});

/* Get  interface__ipobj by interface and ipobj*/
router.get('/interface__ipobj/:interface/:ipobj', function (req, res)
{
    var interface = req.params.interface;
    var ipobj = req.params.ipobj;
    Interface__ipobjModel.getInterface__ipobj(interface,ipobj,function (error, data)
    {
        //If exists interface__ipobj get data
        if (typeof data !== 'undefined')
        {
             res.render("update_interface__ipobj",{ 
                    title : "FWBUILDER", 
                    info : data
                });
            //res.json(200, {"data": data});
        }
        //Get Error
        else
        {
            res.json(404, {"msg": "notExist"});
        }
    });
});



/* Create New interface__ipobj */
router.post("/interface__ipobj", function (req, res)
{
    //Create New objet with data interface__ipobj
    var interface__ipobjData = {
        interface: req.body.interface,
        ipobj: req.body.ipobj,
        interface_order: req.body.interface_order
    };
    
    Interface__ipobjModel.insertInterface__ipobj(interface__ipobjData, function (error, data)
    {
        //If saved interface__ipobj Get data
        if (data && data.msg)
        {
            //res.redirect("/interface__ipobjs/interface__ipobj/" + data.insertId);
            res.json(200, {"msh": data.msg});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update interface__ipobj that exist */
router.put('/interface__ipobj/', function (req, res)
{
    //Save data into object
    var interface__ipobjData = {interface: req.param('interface'), ipobj: req.param('ipobj'), interface_order: req.param('interface_order')};
    var get_interface = req.param('get_interface');
    var get_ipobj = req.param('get_ipobj');
    var get_interface_order = req.param('get_interface_order');
    Interface__ipobjModel.updateInterface__ipobj(get_interface, get_ipobj, get_interface_order,interface__ipobjData, function (error, data)
    {
        //If saved interface__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/interface__ipobjs/interface__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});
/* Update ORDER interface__ipobj that exist */
router.put('/interface__ipobj/order/:new_order', function (req, res)
{
    var new_order = req.param('new_order');
    //Save data into object
    var interface__ipobjData = {interface: req.param('interface'), ipobj: req.param('ipobj'), interface_order: req.param('interface_order')};
    Interface__ipobjModel.updateInterface__ipobj_order(new_order,interface__ipobjData, function (error, data)
    {
        //If saved interface__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/interface__ipobjs/interface__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove interface__ipobj */
router.delete("/interface__ipobj/", function (req, res)
{
    //Id from interface__ipobj to remove
    var interface = req.param('interface');
    var ipobj = req.param('ipobj');
    Interface__ipobjModel.deleteInterface__ipobjidfirewall(interface,ipobj, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/interface__ipobjs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;