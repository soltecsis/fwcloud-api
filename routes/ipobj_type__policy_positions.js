var express = require('express');
var router = express.Router();
var Ipobj_type__policy_positionModel = require('../models/ipobj_type__policy_position');



/* get data para crear nuevos */
router.get('/ipobj-type__policy-position', function (req, res)
{
    res.render('new_ipobj_type__policy_position', {title: 'Crear nuevo ipobj_type__policy_position'});
});

/* Get all ipobj_type__policy_positions*/
router.get('/', function (req, res)
{

    Ipobj_type__policy_positionModel.getIpobj_type__policy_positions(function (error, data)
    {
        //If exists ipobj_type__policy_position get data
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



/* Get  ipobj_type__policy_position by id */
router.get('/:type/:position', function (req, res)
{    
    var type = req.params.type;
    var position = req.params.position;
    
    Ipobj_type__policy_positionModel.getIpobj_type__policy_position(type, position,function (error, data)
    {
        //If exists ipobj_type__policy_position get data
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



/* Create New ipobj_type__policy_position */
router.post("/ipobj-type__policy-position", function (req, res)
{
    //Create New objet with data ipobj_type__policy_position
    var ipobj_type__policy_positionData = {
        type: req.body.type,
        position: req.body.position,
        allowed: req.body.allowed
    };
    
    Ipobj_type__policy_positionModel.insertIpobj_type__policy_position(ipobj_type__policy_positionData, function (error, data)
    {
        //If saved ipobj_type__policy_position Get data
        if (data && data.insertId)
        {
            //res.redirect("/ipobj-type__policy-positions/ipobj-type__policy-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update ipobj_type__policy_position that exist */
router.put('/ipobj-type__policy-position/', function (req, res)
{
    //Save data into object
    var ipobj_type__policy_positionData = {        
        type: req.param('type'),
        position: req.param('position'),
        allowed: req.param('allowed')
    };
    Ipobj_type__policy_positionModel.updateIpobj_type__policy_position(ipobj_type__policy_positionData, function (error, data)
    {
        //If saved ipobj_type__policy_position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/ipobj-type__policy-positions/ipobj-type__policy-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove ipobj_type__policy_position */
router.delete("/ipobj-type__policy-position/", function (req, res)
{
    //Id from ipobj_type__policy_position to remove
    var type = req.params.type;
    var position = req.params.position;
    
    Ipobj_type__policy_positionModel.deleteIpobj_type__policy_position(type, position, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/ipobj-type__policy-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;