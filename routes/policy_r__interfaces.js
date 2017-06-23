var express = require('express');
var router = express.Router();
var Policy_r__interfaceModel = require('../models/policy_r__interface');


/* get data para crear nuevos */
router.get('/policy-r__interface', function (req, res)
{
    res.render('new_policy_r__interface', {title: 'Crear nuevo policy_r__interface'});
});

/* Get all IPOBJ de una interface*/
router.get('/:interface', function (req, res)
{
    var interface = req.params.interface;
    Policy_r__interfaceModel.getPolicy_r__interfaces_rule(interface,function (error, data)
    {
        //If exists policy_r__interface get data
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

/* Get all interface for a rule */
router.get('/:rule', function (req, res)
{
    var rule = req.params.rule;
    Policy_r__interfaceModel.getPolicy_r__interfaces_interface(rule,function (error, data)
    {
        //If exists policy_r__interface get data
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



/* Get  policy_r__interface by rule and interface */
router.get('/:interface/:rule', function (req, res)
{    
    var interface = req.params.interface;
    var rule = req.params.rule;
    
    Policy_r__interfaceModel.getPolicy_r__interface(interface, rule,function (error, data)
    {
        //If exists policy_r__interface get data
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





/* Create New policy_r__interface */
router.post("/policy-r__interface", function (req, res)
{
    //Create New objet with data policy_r__interface
    var policy_r__interfaceData = {
        rule: req.body.rule,
        interface: req.body.interface,
        interface_order: req.body.interface_order,
        direction: req.body.direction,
        negate: req.body.negate,
        position: req.body.position,
        position_order: req.body.position_order        
    };
    
    Policy_r__interfaceModel.insertPolicy_r__interface(policy_r__interfaceData, function (error, data)
    {
        //If saved policy_r__interface Get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update policy_r__interface that exist */
router.put('/policy-r__interface', function (req, res)
{
    var old_order = req.body.get_column_order;
    //Save data into object
    var policy_r__interfaceData = {
        rule: req.body.rule, 
        interface: req.body.interface, 
        interface_order: req.body.interface_order,
        direction: req.body.direction,
        negate: req.body.negate,
        position: req.body.position,
        position_order: req.body.position_order        
    };
    Policy_r__interfaceModel.updatePolicy_r__interface(old_order,policy_r__interfaceData, function (error, data)
    {
        //If saved policy_r__interface saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});


/* Update NEGATE de policy_r__interface that exist */
router.put('/policy-r__interface/:interface/:rule/:position/negate/:negate', function (req, res)
{
    var rule = req.param('rule');
    var interface = req.param('interface');
    var negate = req.param('negate');

    Policy_r__interfaceModel.updatePolicy_r__interface_negate(rule, interface,negate, function (error, data)
    {
        //If saved policy_r__interface saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update ORDER de policy_r__interface that exist */
router.put('/policy-r__interface/:interface/:rule/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.param('rule');
    var interface = req.param('interface');
    var old_order = req.param('old_order');
    var new_order = req.param('new_order');    

    Policy_r__interfaceModel.updatePolicy_r__interface_order(rule, interface,old_order,new_order, function (error, data)
    {
        //If saved policy_r__interface saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});



/* Remove policy_r__interface */
router.delete("/policy-r__interface/", function (req, res)
{
    //Id from policy_r__interface to remove
    var rule = req.param('rule');
    var interface = req.param('interface');
    var old_order = req.param('old_order');
    
    Policy_r__interfaceModel.deletePolicy_r__interfaceidfirewall(rule, interface,old_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-r__interfaces/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

module.exports = router;