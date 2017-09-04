var express = require('express');
var router = express.Router();
var Routing_r__ipobjModel = require('../models/routing_r__ipobj');

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

/* Show form */
router.get('/routing-r__ipobj', function (req, res)
{
    res.render('new_routing_r__ipobj', {title: 'Crear nuevo routing_r__ipobj'});
});

/* Get all routing_r__ipobjs by rule*/

router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    
    Routing_r__ipobjModel.getRouting_r__ipobjs(rule,function (error, data)
    {
        //If exists routing_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
        {
            res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
    
});

/* Get all routing_r__ipobjs by rule and posicion*/

router.get('/:rule/:position', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    
    Routing_r__ipobjModel.getRouting_r__ipobjs_position(rule,position,function (error, data)
    {
        //If exists routing_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
        {
            res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
    
});


/* Get  routing_r__ipobj by id  */

router.get('/:rule/:ipobj/:ipobj_g/:position', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var position = req.params.position;
    Routing_r__ipobjModel.getRouting_r__ipobj(rule,ipobj,ipobj_g,position,function (error, data)
    {
        //If exists routing_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
        {
            res.render("update_routing_r__ipobj",{ 
                    title : "FWBUILDER", 
                    info : data
                });            
            //res.status(200).json( {"data": data});
        }
        //Get Error
        else
        {
            res.status(404).json( {"msg": "notExist"});
        }
    });
});



/* Create New routing_r__ipobj */
router.post("/routing-r__ipobj", function (req, res)
{
    //Create New objet with data routing_r__ipobj
    var routing_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        position: req.body.position,
        position_order: req.body.position_order
    };
    
    Routing_r__ipobjModel.insertRouting_r__ipobj(routing_r__ipobjData, function (error, data)
    {
        //If saved routing_r__ipobj Get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + data.insertId);
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

/* Update routing_r__ipobj that exist */
router.put('/routing-r__ipobj', function (req, res)
{
    var rule = req.body.get_rule;
    var ipobj = req.body.get_ipobj;
    var ipobj_g = req.body.get_ipobj_g;
    var position = req.body.get_position;
    var position_order = req.body.get_position_order;
    
    //Save data into object
    var routing_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        position: req.body.position,
        position_order: req.body.position_order
    };
    Routing_r__ipobjModel.updateRouting_r__ipobj(rule,ipobj,ipobj_g,position, position_order,routing_r__ipobjData, function (error, data)
    {
        //If saved routing_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});

/* Update POSITION routing_r__ipobj that exist */
router.put('/routing-r__ipobj/:rule/:ipobj/:ipobj_g/:position/:position_order/:new_position/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_position = req.params.new_position;
    var new_order = req.params.new_order;
    

    Routing_r__ipobjModel.updateRouting_r__ipobj_position(rule,ipobj,ipobj_g,position,position_order,new_position,new_order, function (error, data)
    {
        //If saved routing_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});

/* Update ORDER routing_r__ipobj that exist */
router.put('/routing-r__ipobj/:rule/:ipobj/:ipobj_g/:position/:position_order/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_order = req.params.new_order;
    
    

    Routing_r__ipobjModel.updateRouting_r__ipobj_position_order(rule,ipobj,ipobj_g,position,position_order,new_order, function (error, data)
    {
        //If saved routing_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__ipobjs/routing-r__ipobj/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});




/* Remove routing_r__ipobj */
router.delete("/routing-r__ipobj/", function (req, res)
{
    //Id from routing_r__ipobj to remove
    var rule = req.body.rule;
    var ipobj = req.body.ipobj;
    var ipobj_g = req.body.ipobj_g;
    var position = req.body.position;
    var position_order = req.body.position_order;
    
    Routing_r__ipobjModel.deleteRouting_r__ipobj(rule,ipobj,ipobj_g,position, position_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-r__ipobjs/");
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});

module.exports = router;