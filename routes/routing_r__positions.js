var express = require('express');
var router = express.Router();
var Routing_r__positionModel = require('../models/routing_r__position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

router.get('/*',isAuthenticated, function (req, res, next){
    return next();
});

/* get data para crear nuevos */
router.get('/routing-r__position', function (req, res)
{
    res.render('new_routing_r__position', {title: 'Crear nuevo routing_r__position'});
});

/* Get all routing_r__positions*/
router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    Routing_r__positionModel.getRouting_r__positions(rule,function (error, data)
    {
        //If exists routing_r__position get data
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



/* Get  routing_r__position by rule and position */
router.get('/:rule/:position', function (req, res)
{    
    var rule = req.params.rule;
    var position = req.params.position;
    Routing_r__positionModel.getRouting_r__position(rule, position,function (error, data)
    {
        //If exists routing_r__position get data
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





/* Create New routing_r__position */
router.post("/routing-r__position", function (req, res)
{
    //Create New objet with data routing_r__position
    var routing_r__positionData = {
        rule: req.body.rule,
        position: req.body.position,
        column_order: req.body.column_order,
        negate: req.body.negate
    };
    
    Routing_r__positionModel.insertRouting_r__position(routing_r__positionData, function (error, data)
    {
        //If saved routing_r__position Get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update routing_r__position that exist */
router.put('/routing-r__position', function (req, res)
{
    var old_order = req.body.get_column_order;
    //Save data into object
    var routing_r__positionData = {
        rule: req.body.rule, 
        position: req.body.position, 
        column_order: req.body.column_order, 
        negate: req.body.negate
    };
    Routing_r__positionModel.updateRouting_r__position(old_order,routing_r__positionData, function (error, data)
    {
        //If saved routing_r__position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update NEGATE de routing_r__position that exist */
router.put('/routing-r__position/:rule/:position/negate/:negate', function (req, res)
{
    var rule = req.param('rule');
    var position = req.param('position');
    var negate = req.param('negate');


    Routing_r__positionModel.updateRouting_r__position_negate(rule, position,negate, function (error, data)
    {
        //If saved routing_r__position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update ORDER de routing_r__position that exist */
router.put('/routing-r__position/:rule/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.param('rule');
    var position = req.param('position');
    var old_order = req.param('old_order');
    var new_order = req.param('new_order');    

    Routing_r__positionModel.updateRouting_r__position_order(rule, position,old_order,new_order, function (error, data)
    {
        //If saved routing_r__position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-r__positions/routing-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove routing_r__position */
router.delete("/routing-r__position/", function (req, res)
{
    //Id from routing_r__position to remove
    var rule = req.param('rule');
    var position = req.param('position');
    var old_order = req.param('old_order');
    
    Routing_r__positionModel.deleteRouting_r__positionidfirewall(rule, position,old_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-r__positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;