var express = require('express');
var router = express.Router();
var Policy_positionModel = require('../models/policy_position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* get data para crear nuevos */
router.get('/policy-position', function (req, res)
{
    res.render('new_policy_position', {title: 'Crear nuevo policy_position'});
});

/* Get all policy_positions*/
router.get('/', function (req, res)
{

    Policy_positionModel.getPolicy_positions(function (error, data)
    {
        //If exists policy_position get data
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

/* Get all policy_positions by Type*/
router.get('/type/:type', function (req, res)
{
    var p_type = req.params.type;
    Policy_positionModel.getPolicy_positionsType(p_type, function (error, data)
    {
        //If exists policy_position get data
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


/* Get  policy_position by id */
router.get('/:id', function (req, res)
{    
    var id = req.params.id;
    Policy_positionModel.getPolicy_position(id,function (error, data)
    {
        //If exists policy_position get data
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

/* Get all policy_positions by nombre */
router.get('/name/:name', function (req, res)
{
    var name = req.params.name;
    Policy_positionModel.getPolicy_positionName(name,function (error, data)
    {
        //If exists policy_position get data
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




/* Create New policy_position */
router.post("/policy-position", function (req, res)
{
    //Create New objet with data policy_position
    var policy_positionData = {
        id: req.body.id,
        name: req.body.comment
    };
    
    Policy_positionModel.insertPolicy_position(policy_positionData, function (error, data)
    {
        //If saved policy_position Get data
        if (data && data.insertId)
        {
            //res.redirect("/policy-positions/policy-position/" + data.insertId);
            res.json(200, {"insertId": data.insertId});
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update policy_position that exist */
router.put('/policy-position/', function (req, res)
{
    //Save data into object
    var policy_positionData = {id: req.param('id'), name: req.param('name'), policy_type: req.param('policy_type'), position_order: req.param('position_order')};
    Policy_positionModel.updatePolicy_position(policy_positionData, function (error, data)
    {
        //If saved policy_position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-positions/policy-position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});



/* Remove policy_position */
router.delete("/policy-position/", function (req, res)
{
    //Id from policy_position to remove
    var idfirewall = req.param('idfirewall');
    var id = req.param('id');
    Policy_positionModel.deletePolicy_positionidfirewall(idfirewall,id, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;