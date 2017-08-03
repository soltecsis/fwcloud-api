var express = require('express');
var router = express.Router();
var Ipobj_type__routing_positionModel = require('../models/ipobj_type__routing_position');


/* get data para crear nuevos */
router.get('/ipobj-type__routing-position', function (req, res)
{
    res.render('new_ipobj_type__routing_position', {title: 'Crear nuevo ipobj_type__routing_position'});
});

/* Get all ipobj_type__routing_positions*/
router.get('/', function (req, res)
{

    Ipobj_type__routing_positionModel.getIpobj_type__routing_positions(function (error, data)
    {
        //If exists ipobj_type__routing_position get data
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



/* Get  ipobj_type__routing_position by id */
router.get('/:type/:position', function (req, res)
{    
    var type = req.params.type;
    var position = req.params.position;
    
    Ipobj_type__routing_positionModel.getIpobj_type__routing_position(type, position,function (error, data)
    {
        //If exists ipobj_type__routing_position get data
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



/* Create New ipobj_type__routing_position */
router.post("/ipobj-type__routing-position", function (req, res)
{
    //Create New objet with data ipobj_type__routing_position
    var ipobj_type__routing_positionData = {
        type: req.body.type,
        position: req.body.position,
        allowed: req.body.allowed
    };
    
    Ipobj_type__routing_positionModel.insertIpobj_type__routing_position(ipobj_type__routing_positionData, function (error, data)
    {
        //If saved ipobj_type__routing_position Get data
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-type__routing-positions/ipobj-type__routing-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update ipobj_type__routing_position that exist */
router.put('/ipobj-type__routing-position/', function (req, res)
{
    //Save data into object
    var ipobj_type__routing_positionData = {        
        type: req.param('type'),
        position: req.param('position'),
        allowed: req.param('allowed')
    };
    Ipobj_type__routing_positionModel.updateIpobj_type__routing_position(ipobj_type__routing_positionData, function (error, data)
    {
        //If saved ipobj_type__routing_position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/ipobj-type__routing-positions/ipobj-type__routing-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove ipobj_type__routing_position */
router.delete("/ipobj-type__routing-position/", function (req, res)
{
    //Id from ipobj_type__routing_position to remove
    var type = req.params.type;
    var position = req.params.position;
    
    Ipobj_type__routing_positionModel.deleteIpobj_type__routing_position(type, position, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-type__routing-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;