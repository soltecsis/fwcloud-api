var express = require('express');
var router = express.Router();
var Policy_r__positionModel = require('../models/policy_r__position');

var isAuthenticated = function (req, res, next) {
  if (req.isAuthenticated())
    return next();
  res.redirect('/');
};

//router.get('/*',isAuthenticated, function (req, res, next){
//    return next();
//});

/* get data para crear nuevos */
router.get('/policy-r__position', function (req, res)
{
    res.render('new_policy_r__position', {title: 'Crear nuevo policy_r__position'});
});

/* Get all policy_r__positions*/
router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    Policy_r__positionModel.getPolicy_r__positions(rule,function (error, data)
    {
        //If exists policy_r__position get data
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



/* Get  policy_r__position by rule and position */
router.get('/:rule/:position', function (req, res)
{    
    var rule = req.params.rule;
    var position = req.params.position;
    Policy_r__positionModel.getPolicy_r__position(rule, position,function (error, data)
    {
        //If exists policy_r__position get data
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





/* Create New policy_r__position */
router.post("/policy-r__position", function (req, res)
{
    //Create New objet with data policy_r__position
    var policy_r__positionData = {
        rule: req.body.rule,
        position: req.body.position,
        column_order: req.body.column_order,
        negate: req.body.negate
    };
    
    Policy_r__positionModel.insertPolicy_r__position(policy_r__positionData, function (error, data)
    {
        //If saved policy_r__position Get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__positions/policy-r__position/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update policy_r__position that exist */
router.put('/policy-r__position', function (req, res)
{
    var old_order = req.body.get_column_order;
    //Save data into object
    var policy_r__positionData = {
        rule: req.body.rule, 
        position: req.body.position, 
        column_order: req.body.column_order, 
        negate: req.body.negate
    };
    Policy_r__positionModel.updatePolicy_r__position(old_order,policy_r__positionData, function (error, data)
    {
        //If saved policy_r__position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__positions/policy-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update NEGATE de policy_r__position that exist */
router.put('/policy-r__position/:rule/:position/negate/:negate', function (req, res)
{
    var rule = req.param('rule');
    var position = req.param('position');
    var negate = req.param('negate');


    Policy_r__positionModel.updatePolicy_r__position_negate(rule, position,negate, function (error, data)
    {
        //If saved policy_r__position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__positions/policy-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update ORDER de policy_r__position that exist */
router.put('/policy-r__position/:rule/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.param('rule');
    var position = req.param('position');
    var old_order = req.param('old_order');
    var new_order = req.param('new_order');    

    Policy_r__positionModel.updatePolicy_r__position_order(rule, position,old_order,new_order, function (error, data)
    {
        //If saved policy_r__position saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__positions/policy-r__position/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});



/* Remove policy_r__position */
router.delete("/policy-r__position/", function (req, res)
{
    //Id from policy_r__position to remove
    var rule = req.param('rule');
    var position = req.param('position');
    var old_order = req.param('old_order');
    
    Policy_r__positionModel.deletePolicy_r__positionidfirewall(rule, position,old_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-r__positions/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

module.exports = router;