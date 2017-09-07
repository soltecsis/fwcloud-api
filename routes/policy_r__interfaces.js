var express = require('express');
var router = express.Router();
var Policy_r__interfaceModel = require('../models/policy_r__interface');

/**
* Property Logger to manage App logs
*
* @property logger
* @type log4js/app
* 
*/
var logger = require('log4js').getLogger("app");

router.param('rule', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))
        res.status(404).json( {"msg": "param rule Error"});
    else
        next(); 
});

router.param('interface', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))
        res.status(404).json( {"msg": "param interface Error"});
    else
        next(); 
});
router.param('position', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))    {
        res.status(404).json( {"msg": "param position Error"});
    }
    else
        next(); 
});
router.param('position_order', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))    {
        req.params.position=1;
    }
    next(); 
});
router.param('new_rule', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))
        res.status(404).json( {"msg": "param new_rule Error"});
    else
        next(); 
});
router.param('new_position', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))    {
        res.status(404).json( {"msg": "param new_position Error"});
    }
    else
        next(); 
});
router.param('new_order', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))    {
        req.params.new_order=1;
    }
    next(); 
});
router.param('negate', function(req, res, next, param) {
    if (param===undefined || param==='' || isNaN(param))    {
        req.params.negate=0;
    }
    next(); 
});

function checkPostParameters(obj){
    logger.debug(obj);
    for(var propt in obj){
        logger.debug(propt + ': ' + obj[propt]);
        if (obj[propt]===undefined){
            logger.debug("PARAMETRO UNDEFINED: " + propt);
            obj[propt]=0;
        }
    }
    return obj;
}

/* get data para crear nuevos */
router.get('/policy-r__interface', function (req, res)
{
    res.render('new_policy_r__interface', {title: 'Crear nuevo policy_r__interface'});
});

/* Get all IPOBJ de una interface*/
router.get('/:firewall/:interface', function (req, res)
{
    var interface = req.params.interface;
    Policy_r__interfaceModel.getPolicy_r__interfaces_rule(interface,function (error, data)
    {
        //If exists policy_r__interface get data
        if (typeof data !== 'undefined')
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

/* Get all interface for a rule */
router.get('/:firewall/:rule', function (req, res)
{
    var rule = req.params.rule;
    Policy_r__interfaceModel.getPolicy_r__interfaces_interface(rule,function (error, data)
    {
        //If exists policy_r__interface get data
        if (typeof data !== 'undefined')
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



/* Get  policy_r__interface by rule and interface */
router.get('/:firewall/:rule/:interface', function (req, res)
{    
    var interface = req.params.interface;
    var rule = req.params.rule;
    
    Policy_r__interfaceModel.getPolicy_r__interface(interface, rule,function (error, data)
    {
        //If exists policy_r__interface get data
        if (typeof data !== 'undefined')
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





/* Create New policy_r__interface */
router.post("/policy-r__interface", function (req, res)
{
    //Create New objet with data policy_r__interface
    var policy_r__interfaceData = {
        rule: req.body.rule,
        interface: req.body.interface,
        negate: req.body.negate,
        position: req.body.position,
        position_order: req.body.position_order        
    };
    
    policy_r__interfaceData=checkPostParameters(policy_r__interfaceData);
    
    Policy_r__interfaceModel.insertPolicy_r__interface(policy_r__interfaceData, function (error, data)
    {
        //If saved policy_r__interface Get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + data.insertId);
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

/* Update policy_r__interface that exist */
router.put('/policy-r__interface', function (req, res)
{
    var rule = req.body.get_rule;    
    var interface = req.body.get_interface;
    var position = req.body.get_position;
    var position_order = req.body.get_position_order;
    
    //Save New data into object
    var policy_r__interfaceData = {
        rule: req.body.rule, 
        interface: req.body.interface, 
        negate: req.body.negate,
        position: req.body.position,
        position_order: req.body.position_order        
    };
    policy_r__interfaceData=checkPostParameters(policy_r__interfaceData);
    
    Policy_r__interfaceModel.updatePolicy_r__interface(rule, interface, position, position_order,policy_r__interfaceData, function (error, data)
    {
        //If saved policy_r__interface saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

/* Update POSITION policy_r__interface that exist */
router.put('/policy-r__interface/:firewall/:rule/:interface/:position/:position_order/:new_rule/:new_position/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var interface = req.params.interface;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_rule = req.params.new_rule;
    var new_position = req.params.new_position;
    var new_order = req.params.new_order;
    
    
    Policy_r__interfaceModel.updatePolicy_r__interface_position(rule,interface,position,position_order,new_rule,new_position,new_order, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"msg": error});
        }
    });
});


/* Update NEGATE de policy_r__interface that exist */
router.put('/policy-r__interface/:firewall/:rule/:interface/:position/negate/:negate', function (req, res)
{
    var rule = req.params.rule;
    var interface = req.params.interface;
    var negate = req.params.negate;
    var position = req.params.position;

    Policy_r__interfaceModel.updatePolicy_r__interface_negate(rule, interface,position, negate, function (error, data)
    {
        //If saved policy_r__interface saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

/* Update ORDER de policy_r__interface that exist */
router.put('/policy-r__interface/:firewall/:rule/:interface/:position/order/:old_order/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var interface = req.params.interface;
    var position = req.params.position;
    var old_order = req.params.old_order;
    var new_order = req.params.new_order;    

    Policy_r__interfaceModel.updatePolicy_r__interface_order(rule, interface,position,old_order,new_order, function (error, data)
    {
        //If saved policy_r__interface saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__interfaces/policy-r__interface/" + req.param('id'));
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});



/* Remove policy_r__interface */
router.delete("/policy-r__interface/:firewall/:rule/:interface/:position/:position_order", function (req, res)
{
    //Id from policy_r__interface to remove
    var rule = req.params.rule;
    var interface = req.params.interface;
    var position = req.params.position;
    var old_order = req.params.position_order;
    
        
    Policy_r__interfaceModel.deletePolicy_r__interface(rule, interface, position, old_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-r__interfaces/");
            res.status(200).json( data.msg);
        } else
        {
            res.status(500).json( {"error": error});
        }
    });
});

/* Reorder ALL rule positions  */
router.put("/policy-r__interface/order", function (req, res)
{
    
    Policy_r__interfaceModel.orderAllPolicy(  function (error, data)
    {
        if (data && data.msg === "success" || data.msg === "notExist")
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

/* Reorder ALL rule positions  */
router.put("/policy-r__interface/order/:rule", function (req, res)
{
    var rule = req.params.rule;
    Policy_r__interfaceModel.orderPolicy(rule, function (error, data)
    {
        if (data && data.msg === "success" || data.msg === "notExist")
        {
            res.status(200).json(data.msg);
        } else
        {
            res.status(500).json({"msg": error});
        }
    });
});

module.exports = router;