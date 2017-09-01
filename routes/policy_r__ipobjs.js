var express = require('express');
var router = express.Router();
var Policy_r__ipobjModel = require('../models/policy_r__ipobj');


/* Show form */
router.get('/policy-r__ipobj', function (req, res)
{
    res.render('new_policy_r__ipobj', {title: 'Crear nuevo policy_r__ipobj'});
});

/* Get all policy_r__ipobjs by rule*/

router.get('/:firewall/:rule', function (req, res)
{
    var rule = req.params.rule;
    
    Policy_r__ipobjModel.getPolicy_r__ipobjs(rule,function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
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

/* Get all policy_r__ipobjs by rule and posicion*/

router.get('/:firewall/:rule/:position', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    
    Policy_r__ipobjModel.getPolicy_r__ipobjs_position(rule,position,function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
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

/* Get all policy_r__ipobjs by rule and posicion with IPOBJ DATA*/

router.get('/data/:firewall/:rule/:position', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    
    Policy_r__ipobjModel.getPolicy_r__ipobjs_position_data(rule,position,function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
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


/* Get  policy_r__ipobj by id  */

router.get('/:firewall/:rule/:ipobj/:ipobj_g/:interface/:position', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;
    Policy_r__ipobjModel.getPolicy_r__ipobj(rule,ipobj,ipobj_g,interface,position,function (error, data)
    {
        //If exists policy_r__ipobj get data
        if (typeof data !== 'undefined' && data.length>0)
        {
            res.render("update_policy_r__ipobj",{ 
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



/* Create New policy_r__ipobj */
router.post("/policy-r__ipobj", function (req, res)
{
    //Create New objet with data policy_r__ipobj
    var policy_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        interface: req.body.interface,
        position: req.body.position,
        position_order: req.body.position_order        
        
    };
    
    Policy_r__ipobjModel.insertPolicy_r__ipobj(policy_r__ipobjData,0, function (error, data)
    {
        //If saved policy_r__ipobj Get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + data.insertId);
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update policy_r__ipobj that exist */
router.put('/policy-r__ipobj', function (req, res)
{
    var rule = req.body.get_rule;
    var ipobj = req.body.get_ipobj;
    var ipobj_g = req.body.get_ipobj_g;
    var interface = req.body.get_interface;
    var position = req.body.get_position;
    var position_order = req.body.get_position_order;
    
    
    //Save data into object
    var policy_r__ipobjData = {
        rule: req.body.rule,
        ipobj: req.body.ipobj,
        ipobj_g: req.body.ipobj_g,
        interface: req.body.interface,
        position: req.body.position,
        position_order: req.body.position_order
       
    };
    
    Policy_r__ipobjModel.updatePolicy_r__ipobj(rule,ipobj,ipobj_g,interface,position, position_order,policy_r__ipobjData, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"error": error});
        }
    });
});

/* Update POSITION policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:firewall/:rule/:ipobj/:ipobj_g/:position/:position_order/:new_position/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_position = req.params.new_position;
    var new_order = req.params.new_order;
    
    
    Policy_r__ipobjModel.updatePolicy_r__ipobj_position(rule,ipobj,ipobj_g,interface,position,position_order,new_position,new_order, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update NEGATE policy_r__ipobj that exist */
/* Update ALL IPOBJ/POLICY_R TO new NEGATE satus*/
router.put('/policy-r__ipobj/:firewall/:rule/:position/:negate', function (req, res)
{
    var rule = req.params.rule;
    var position = req.params.position;
    var negate = req.params.negate;
    

    Policy_r__ipobjModel.updatePolicy_r__ipobj_negate(rule,position,negate, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

/* Update ORDER policy_r__ipobj that exist */
router.put('/policy-r__ipobj/:rule/:ipobj/:ipobj_g/:position/:position_order/:new_order', function (req, res)
{
    var rule = req.params.rule;
    var ipobj = req.params.ipobj;
    var ipobj_g = req.params.ipobj_g;
    var interface = req.params.interface;
    var position = req.params.position;
    var position_order = req.params.position_order;
    var new_order = req.params.new_order;
    
    

    Policy_r__ipobjModel.updatePolicy_r__ipobj_position_order(rule,ipobj,ipobj_g,interface,position,position_order,new_order, function (error, data)
    {
        //If saved policy_r__ipobj saved ok, get data
        if (data && data.msg)
        {
            //res.redirect("/policy-r__ipobjs/policy-r__ipobj/" + req.param('id'));
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});




/* Remove policy_r__ipobj */
router.delete("/policy-r__ipobj/", function (req, res)
{
    //Id from policy_r__ipobj to remove
    var rule = req.body.rule;
    var ipobj = req.body.ipobj;
    var ipobj_g = req.body.ipobj_g;
    var interface = req.body.interface;
    var position = req.body.position;
    var position_order = req.body.position_order;
    
    Policy_r__ipobjModel.deletePolicy_r__ipobj(rule,ipobj,ipobj_g,interface, position, position_order, function (error, data)
    {
        if (data && data.msg === "deleted" || data.msg === "notExist")
        {
            //res.redirect("/policy-r__ipobjs/");
            res.json(200, data.msg);
        } else
        {
            res.json(500, {"msg": error});
        }
    });
});

module.exports = router;