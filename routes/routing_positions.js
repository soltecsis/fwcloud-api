var express = require('express');
var router = express.Router();
var Routing_positionModel = require('../models/routing_position');


/* get data para crear nuevos */
router.get('/routing-position', function (req, res)
{
    res.render('new_routing_position', {title: 'Crear nuevo routing_position'});
});

/* Get all routing_positions*/
router.get('/', function (req, res)
{

    Routing_positionModel.getRouting_positions(function (error, data)
    {
        //If exists routing_position get data
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



/* Get  routing_position by id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Routing_positionModel.getRouting_position(id,function (error, data)
    {
        //If exists routing_position get data
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

/* Get all routing_positions by nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Routing_positionModel.getRouting_positionName(name,function (error, data)
    {
        //If exists routing_position get data
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




/* Create New routing_position */
router.post("/routing-position", function (req, res)
{
    //Create New objet with data routing_position
    var routing_positionData = {
        id: req.body.id,
        name: req.body.comment
    };
    
    Routing_positionModel.insertRouting_position(routing_positionData, function (error, data)
    {
        //If saved routing_position Get data
        if (data && data.insertId)
        {
            //res.redirect("/routing-positions/routing-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update routing_position that exist */
router.put('/routing-position/', function (req, res)
{
    //Save data into object
    var routing_positionData = {id: req.param('id'), name: req.param('name')};
    Routing_positionModel.updateRouting_position(routing_positionData, function (error, data)
    {
        //If saved routing_position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/routing-positions/routing-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove routing_position */
router.delete("/routing-position/", function (req, res)
{
    //Id from routing_position to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Routing_positionModel.deleteRouting_positionidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/routing-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;